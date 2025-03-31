const Product = require('../../models/productSchema')
const Order = require('../../models/orderSchema')
const Category = require('../../models/categorySchema')
const User = require('../../models/userSchema')
const Cart = require('../../models/cartSchema')
const Address = require("../../models/addressSchema");  
const mongoose = require("mongoose");



const getListOfOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; 
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find()
      .populate({
        path: 'orderedItems.product',
        select: 'productName productImage'
      })
      .populate('userId', 'name email')
      .populate('address')
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

      const ordersWithItemDetails = orders.map(order => {
        const nonCancelledItems = order.orderedItems.filter(item => item.status !== 'Cancelled');
      
        const items = order.orderedItems.map(item => ({
          name: item.product ? item.product.productName : "Unknown Product",
          size: item.size || "N/A",
          quantity: item.quantity || 0,
          price: item.price || 0,
          status: item.status,
          image: item.product?.productImage?.[0] || "No image"
        }));
      
        let totalPrice = 0;
        nonCancelledItems.forEach(item => {
          totalPrice += item.price * item.quantity;
        });
      
        const discount = order.status === 'Cancelled' ? 0 : order.discount || 0;
        const finalAmount = order.status === 'Cancelled' ? 0 : totalPrice - discount;
      
        return {
          _id: order._id,
          orderId: order.orderId,
          user: {
            name: order.userId?.name || "Unknown",
            email: order.userId?.email || ""
          },
          address: order.address,
          createdOn: order.createdOn,
          status: order.status,
          totalItems: order.orderedItems.length,
          items,
          totalPrice: order.status === 'Cancelled' ? 0 : totalPrice,
          discount,
          finalAmount
        };
      });
      

    res.render('admin/order', {
      orders: ordersWithItemDetails,
      totalPages,
      currentPage: page
    });

  } catch (error) {
    console.error("Error while getting orders:", error);
    next(error);
  }
};





const updateStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const statusFlow = ['Pending', 'Processing', 'Shipped', 'Delivered'];

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if ((order.status === 'Cancelled' || order.status === 'Return Requested') && status !== 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: `Cannot change status. Order is already '${order.status}'.`
      });
    }

    if (status === 'Cancelled') {
      if (order.status === 'Cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Order is already cancelled.'
        });
      }

      if (order.status === 'Delivered') {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel an order that is already delivered.'
        });
      }

      order.status = 'Cancelled';

      order.orderedItems.forEach(item => {
        if (item.status !== 'Returned') {
          item.status = 'Cancelled';
        }
      });

      await order.save();
      return res.json({ success: true, message: 'Order cancelled successfully' });
    }

 
    const currentStatusIndex = statusFlow.indexOf(order.status);
    const newStatusIndex = statusFlow.indexOf(status);

    if (newStatusIndex < currentStatusIndex) {
      return res.status(400).json({
        success: false,
        message: `Cannot move order status backward from '${order.status}' to '${status}'.`
      });
    }

    order.status = status;

    order.orderedItems.forEach(item => {
      if (item.status !== 'Cancelled' && item.status !== 'Returned') {
        item.status = status;
      }
    });

    if (status === 'Delivered') {
      order.invoiceDate = new Date();
    }

    await order.save();
    res.json({ success: true, message: 'Order status updated successfully' });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};






const getOrderDetails = async (req, res) => {
  try {
   
    const { orderId } = req.params;

    if(!mongoose.Types.ObjectId.isValid(orderId)){
      return res.status(400).send("Invalid mongodb object id")
    }

    const order = await Order.findById(orderId)  
      .populate('userId', 'name email')
      .populate('orderedItems.product');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const addressDoc = await Address.findOne({ userId: order.userId._id });

    const selectedAddress = addressDoc?.address?.find(addr => addr.status === true) || addressDoc?.address?.[0];

    res.render('admin/orderDetail', { order, address: selectedAddress });

  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).send('Server error');
  }
};



const requestReturn = async (req, res, next) => {
  try {
    const ordId = req.query.id;
    const proIdd = req.query.proId;

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: ordId, "orderedItems._id": proIdd },
      { $set: { "orderedItems.$.status": "Return Requested" } },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order or product not found." });
    }

    res.status(200).json({ message: "Return request submitted." });
  } catch (error) {
    next(error);
  }
};


const returnAccept = async (req, res, next) => {
  try {
    const ordId = req.body.orderId;
    const proIdd = req.body.itemId;

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: ordId, "orderedItems._id": proIdd },
      { $set: { "orderedItems.$.status": "Returned" } },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order or product not found." });
    }

    const item = updatedOrder.orderedItems.find(item => item._id.toString() === proIdd);
    if (!item) {
      return res.status(404).json({ message: "Product not found in order." });
    }

    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });

    const refundAmount = item.price;
    let refundFinalAmount = refundAmount;

    if (updatedOrder.discount >= 1) {
      refundFinalAmount = Math.floor(refundAmount - (refundAmount * updatedOrder.discount / 100));
    }

    const newOrderAmount = updatedOrder.totalPrice - refundFinalAmount;
    await Order.findByIdAndUpdate(ordId, { $set: { totalPrice: newOrderAmount } });

    if (updatedOrder.paymentMethod !== 'COD') {
      await User.findByIdAndUpdate(
        updatedOrder.userId,
        {
          $inc: { wallet: refundFinalAmount },
          $push: {
            walletHistory: {
              transactionId: `REF-${Date.now()}`,
              type: "credit",
              amount: refundFinalAmount,
              status: "Completed"
            }
          }
        }
      );
    }

    res.redirect('/admin/orders'); 

  } catch (error) {
    next(error);
  }
};



const returnReject = async (req, res, next) => {
  try {
    const { orderId, itemId } = req.body;

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, "orderedItems._id": itemId },
      { $set: { "orderedItems.$.status": "Return Rejected" } },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order or product not found." });
    }

    res.redirect(`/admin/Orders/${orderId}`);

  } catch (error) {
    next(error);
  }
};


    
module.exports={
    getListOfOrders,
    updateStatus,
    getOrderDetails,
    requestReturn,
    returnReject,
    returnAccept
    
}