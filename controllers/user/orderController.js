
const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema');
const Category = require('../../models/categorySchema')
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");
const { response } = require('express');
const mongoose = require ('mongoose')
const { ObjectId } = require("mongoose").Types;
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema')
const Razorpay = require('razorpay');



const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID, // From your .env file
    key_secret: process.env.RAZORPAY_KEY_SECRET, // From your .env file
});
const loadOrder = async (req, res) => {
    try {
        const searchQuery = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const query = {};
        if (searchQuery) {
            query.orderId = { $regex: searchQuery, $options: "i" };
        }
        
        query.userId = req.session.user._id;
    
        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);
        
        const orders = await Order.find(query)
            .sort({ createdOn: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
   
        res.render("user/orders", {
            orders,
            currentPage: page,
            totalPages,
            searchQuery,
            user: req.session.user
        });
    } catch (err) {
        console.error("Error loading orders:", err);
        res.status(500).render("error", { 
            message: "Failed to load orders. Please try again later."
        });
    }
};
  






const viewOrderDetails = async (req, res, next) => {
    try {
      const categoryData = await Category.find({ is_Listed: true });
  
      const order = await Order.findOne({ orderId: req.params.orderId })
        .populate('orderedItems.product')
        .populate('address'); 
   
      if (!order) {
        return res.render('user/orderDetails', {
          login: req.session.user,
          order: null,
          categoryData
        });
      }
  
      res.render('user/orderDetails', { login: req.session.user, order, categoryData });
    } catch (error) {
      next(error, req, res);
    }
  };
  
  
  
  
  const cancelSingleProduct = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { cancelReason, productId, size } = req.body;
        const userId = req.session.user;

        if (!userId) {
            console.error("Session user not found");
            return res.status(401).json({ success: false, message: 'User not authenticated.' });
        }

        const order = await Order.findById(orderId).populate({
            path: 'orderedItems.product',
            select: 'productName salePrice regularPrice productOffer sizes productImage'
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const item = order.orderedItems.find(item =>
            item.product._id.toString() === productId &&
            item.size.trim().toUpperCase() === size.trim().toUpperCase()
        );

        if (!item) {
            return res.status(404).json({ success: false, message: 'Product not found in the order' });
        }

        if (item.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Item is already cancelled' });
        }

        const itemTotal = item.price * item.quantity;
        const remainingItems = order.orderedItems.filter(orderItem =>
            !(orderItem.product._id.toString() === productId && orderItem.size === size) &&
            orderItem.status !== 'Cancelled' && orderItem.status !== 'Returned'
        );
        const remainingTotal = remainingItems.reduce((total, orderItem) =>
            total + (orderItem.price * orderItem.quantity), 0
        );
        const meetsMinimumAmount = remainingTotal >= (order.couponMinPrice || 0);

        let refundAmount;
        if (!meetsMinimumAmount && order.discount) {
            refundAmount = itemTotal - order.discount;
            order.discount = 0;
        } else {
            refundAmount = itemTotal;
        }

        await Product.updateOne(
            { _id: productId, 'sizes.size': size },
            { $inc: { 'sizes.$.quantity': item.quantity } }
        );

        item.status = 'Cancelled';
        item.cancelReason = cancelReason;

        const allItemsCancelled = order.orderedItems.every(item =>
            item.status === 'Cancelled' || item.status === 'Returned'
        );
        if (allItemsCancelled) {
            order.status = 'Cancelled';
            order.finalAmount = 0;
        } else {
            order.finalAmount = remainingTotal - (meetsMinimumAmount ? order.discount : 0);
        }

        let currentWalletBalance = 0;
        if (order.paymentMethod !== 'Cash on Delivery' && refundAmount > 0) {
            const user = await User.findById(userId);
            if (!user) {
                console.error("User not found for refund:", userId);
                return res.status(500).json({ success: false, message: 'User not found for refund.' });
            }

            user.wallet += refundAmount;
            user.walletHistory.push({
                transactionId: `TXN${Date.now()}`,
                type: 'credit',
                amount: refundAmount,
                date: new Date(),
                description: !meetsMinimumAmount
                    ? 'Product refund with adjusted coupon discount'
                    : 'Product refund'
            });

            await user.save();
            currentWalletBalance = user.wallet;
        }

        await order.save();

        return res.status(200).json({
            success: true,
            message: 'Product cancelled successfully',
            refundDetails: {
                itemPrice: itemTotal,
                refundAmount,
                meetsMinimumAmount
            },
            orderTotals: {
                remainingTotal,
                finalAmount: order.finalAmount
            },
            currentWalletBalance,
            redirectUrl: '/userProfile?tab=orders'
        });

    } catch (error) {
        console.error('Error in cancelSingleProduct:', error.stack);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while canceling the product',
            error: error.message
        });
    }
};


const cancelOrder = async (req, res) => {
    try {
        const { orderId, reason } = req.body;

        const order = await Order.findById(orderId)
            .populate('orderedItems.product')
            .populate('userId');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'Pending' && order.status !== 'Processing') {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel order. Order status must be Pending or Processing.'
            });
        }

        // Store the original amount to refund
        const refundAmount = order.finalAmount;

        // Update order status
        order.status = 'Cancelled';
        order.cancelReason = reason || 'No reason provided';
        order.cancelledAt = new Date();
        order.finalAmount = 0; // Set to 0 after storing refundAmount

        // Update all items to Cancelled
        order.orderedItems.forEach(item => {
            item.status = 'Cancelled';
            item.cancelReason = reason || 'No reason provided';
        });

        // Restock products
        for (const item of order.orderedItems) {
            const product = await Product.findById(item.product._id);
            if (product) {
                const sizeIndex = product.sizes.findIndex(v => v.size === item.size);
                if (sizeIndex !== -1) {
                    product.sizes[sizeIndex].quantity += item.quantity;
                }
                await product.save();
            }
        }

        // Refund logic
        if (order.paymentMethod !== 'Cash on Delivery' && refundAmount > 0) {
            const user = order.userId;
            if (!user) {
                console.error("User not found for refund:", order.userId);
                return res.status(500).json({ success: false, message: 'User not found for refund.' });
            }

            if (order.paymentMethod === 'razorpay') {
                const paymentId = order.razorpayPaymentId || order.paymentDetails?.razorpayPaymentId;
                if (!paymentId) {
                    console.error("Razorpay Payment ID missing for order:", orderId, "Full order:", order);
                    return res.status(500).json({
                        success: false,
                        message: 'Razorpay Payment ID not found. Cannot process refund.'
                    });
                }
            
                try {
                    const refund = await razorpayInstance.payments.refund(paymentId, {
                        amount: refundAmount * 100,
                        speed: 'normal',
                        notes: { reason: cancelReason || 'Single product cancellation', orderId }
                    });
                    console.log("Razorpay refund initiated:", refund);
            
                    console.log("Wallet Before:", user.wallet);
                    user.wallet += refundAmount;
                    user.walletHistory.push({
                        transactionId: `REF-${order._id}`,
                        date: new Date(),
                        type: 'credit',
                        amount: refundAmount,
                        status: 'Completed',
                        description: 'Refund for Razorpay order cancellation'
                    });
            
                    try {
                        await user.save();
                        console.log("Wallet After Save:", user.wallet);
                        currentWalletBalance = user.wallet;
                    } catch (saveError) {
                        console.error("Failed to save user wallet:", saveError.stack);
                        return res.status(500).json({
                            success: false,
                            message: 'Refund processed, but failed to update wallet.'
                        });
                    }
                } catch (razorpayError) {
                    console.error("Razorpay refund failed:", razorpayError.stack);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to process Razorpay refund.',
                        error: razorpayError.message
                    });
                }
            }
            else if (order.paymentMethod === 'Wallet Payment') {
                // Refund directly to wallet for Wallet Payment
                user.wallet += refundAmount;
                user.walletHistory.push({
                    transactionId: `REF-${order._id}`,
                    date: new Date(),
                    type: 'credit',
                    amount: refundAmount,
                    status: 'Completed',
                    description: 'Refund for wallet order cancellation'
                });
            }

            await user.save();
        }

        await order.save();

        return res.status(200).json({
            success: true,
            message: order.paymentMethod !== 'Cash on Delivery'
                ? 'Order cancelled and amount refunded successfully.'
                : 'Order cancelled successfully (COD - No refund needed).',
            refundAmount: refundAmount > 0 ? refundAmount : null
        });

    } catch (error) {
        console.error(`Error cancelling order: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: 'Error cancelling order.',
            error: error.message
        });
    }
};


const updateOrderStatus = async (req, res) => {
    const orderId = req.params.orderId;
  
    const order = await Order.findById(orderId);
    
  
    order.status = 'Delivered';
  
    order.orderedItems.forEach(item => {
      item.status = 'Delivered';
    });
  
    await order.save();
    
    res.redirect('/admin/orders'); 
  };



  const productReturn = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { returnReason, productId, size } = req.body;
        const userId = req.session.user;


        const order = await Order.findOne({ _id: orderId }).populate({
            path: 'orderedItems.product',
            select: 'productName salePrice regularPrice productOffer sizeVariants productImage'
        });
        


        console.log("order",order);
        
        if (!order) {
         
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const orderItem = order.orderedItems.find(
            item => item.product._id.toString() === productId && item.size === size
        );

        if (!orderItem) {
            console.log("Item not found in order");
            return res.status(404).json({
                success: false,
                message: 'Selected product with specified size was not found in your order.'
            });
        }

        console.log("Item found. Current status:", orderItem.status);

        if (orderItem.status === 'Returned' || orderItem.status === 'Return Request') {
            console.log("Already in return process");
            return res.status(400).json({
                success: false,
                message: 'This item is already in return process'
            });
        }

        if (orderItem.status !== 'Delivered') {
            console.log("Item status not Delivered:", orderItem.status);
            return res.status(400).json({
                success: false,
                message: `Cannot return product in ${orderItem.status} status`
            });
        }

        orderItem.status = 'Return Request';
        orderItem.returnReason = returnReason;
        orderItem.returnRequestedAt = new Date();

        const allItemsReturnedOrRequested = order.orderedItems.every(item =>
            item.status === 'Return Request' || item.status === 'Returned'
        );

        if (allItemsReturnedOrRequested) {
            order.status = 'Return Request';
            order.returnStatus = 'Pending';
        }

        await order.save();
     

        return res.status(200).json({
            success: true,
            message: 'Return request submitted successfully',
            updatedItem: orderItem,
            redirectUrl: '/userProfile?tab=orders'
        });

    } catch (error) {
        console.error('Error in productReturn:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while processing the return request'
        });
    }
};





const downloadInvoice = async (req, res) => {
    try {
      const orderId = req.query.id; 
      const userId = req.session.user;

      const order = await Order.findOne({ _id: orderId, userId }).populate('orderedItems.product');

  
      if (!order) {
        console.log('Order not found');
        return res.status(404).send('Order not found');
      }
  
      const userAddress = await Address.findOne({
        userId,
        'address.status': true
      });
  
      let shippingAddress = null;
      if (userAddress) {
        shippingAddress = userAddress.address.find(addr => addr.status === true);
      }
  
      if (!shippingAddress) {
        console.log('No shipping address selected (status:true) for this user.');
      }
  
      res.render('user/invoice', { order, shippingAddress });
  
    } catch (err) {
      console.error('Error generating invoice:', err);
      res.status(500).send('Internal Server Error');
    }
  };
  
  











module.exports = {
    loadOrder,
    viewOrderDetails,
    cancelSingleProduct,
    cancelOrder,
    productReturn,
    updateOrderStatus,
    downloadInvoice
};
