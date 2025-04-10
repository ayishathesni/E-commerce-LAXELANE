const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");
const Coupon = require("../../models/couponSchema");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const Razorpay = require('razorpay');
const crypto = require('crypto');


const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const loadCheckout = async (req, res, next) => {
  try {
    const categoryData = await Category.find({ is_Listed: true });

    if (!req.session.user) return res.redirect('/login');

    const msg = req.flash('flash');
    const userId = req.session.user._id;
    const userData = await User.findById(userId).populate('orderHistory');
    const addressData = await Address.findOne({ userId });

    const cartData = await Cart.findOne({ userId }).populate('items.productId');
    if (!cartData || cartData.items.length === 0) return res.redirect('/cart');

    const filteredItems = cartData.items.filter(item => item.productId && !item.productId.isBlocked);

    let productRemovedMsg = null;
    let stockWarningMsg = null;
    const validItems = [];

    for (let item of filteredItems) {
      const product = item.productId;
      const matchedSize = product.sizes.find(s => s.size === item.size);


      const availableStock = matchedSize ? matchedSize.quantity : product.stock;

      if (availableStock >= item.quantity) {
        validItems.push(item);
      } else {
        productRemovedMsg = productRemovedMsg || [];
        productRemovedMsg.push(
          `Product "${product.productName}" has only ${availableStock} units available, but you requested ${item.quantity}. It was removed from your cart.`
        );
      }
    }

    if (validItems.length !== filteredItems.length) {
      cartData.items = validItems;
      await cartData.save();
    }

    const totalCartPrice = validItems.reduce((acc, item) => {
      const itemTotal = item.price * item.quantity;
      return acc + itemTotal;
    }, 0);

    const products = validItems.map(item => ({
      name: item.productId.productName || 'Product',
      price: item.price,
      quantity: item.quantity,
      size: item.size,
      itemTotal: item.price * item.quantity
    }));



    const modifiedCartData = {
      ...cartData.toObject(),
      items: validItems,
      products,
      totalCartPrice,
      couponDiscount: req.session?.appliedCoupon?.couponDiscount
    };

    res.render("user/checkout", {
      login: req.session.user,
      categoryData,
      address: addressData,
      userData,
      msgg: msg,
      cartData: modifiedCartData,
      productRemovedMsg
    });

  } catch (error) {
    console.error('Checkout load error:', error);
    next(error);
  }
};





const verifyCheckOutAddress = async (req, res, next) => {
  try {
    const userId = req.query.id;
    const selectedAddressId = req.query.selectedAddressId;
    const userAddress = await Address.findOne({ userId: userId });
    if (!userAddress || !userAddress.address || userAddress.address.length === 0) {
      return res.status(404).send({ success: false, message: "No address found" });
    }
    const selectedAddress = userAddress.address.find(addr => addr._id.toString() === selectedAddressId);
    res.send({
      success: true,
      addresses: userAddress.address,
      selectedAddress: selectedAddress || null
    });

  } catch (error) {
    console.error("Error fetching address:", error);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
};





const addAddressCheckout = async (req, res) => {
  try {


    if (!req.body.userId || !req.body.address || req.body.address.length === 0) {
      return res.status(400).json({ message: "Invalid request data" });
    }


    if (!ObjectId.isValid(req.body.userId)) {
      return res.status(400).json({ message: "Invalid User ID format" });
    }

    const userId = new ObjectId(req.body.userId);

    let userAddress = await Address.findOne({ userId });

    if (!userAddress) {
      userAddress = new Address({
        userId,
        address: req.body.address
      });
    } else {
      userAddress.address.push(...req.body.address);
    }

    await userAddress.save();
    res.status(201).json({ success: true, message: "Address added successfully" });

  } catch (error) {
    console.error("Error Adding Address:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};




const editAddressCheckout = async (req, res) => {
  try {


    const { id, addressType, name, address, city, landMark, state, pincode, phone, altPhone } = req.body;
    const userId = req.session.user;

    if (!userId) {
      console.error("User not authenticated.");
      return res.status(401).json({ success: false, message: "User not authenticated." });
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      console.error("Invalid Address ID:", id);
      return res.status(400).json({ success: false, message: "Invalid or missing address ID." });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error("User not found:", userId);
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const userAddress = await Address.findOne({ userId });


    if (!userAddress || !Array.isArray(userAddress.address) || userAddress.address.length === 0) {
      return res.status(404).json({ success: false, message: "Address not found." });
    }

    const objectId = new mongoose.Types.ObjectId(id);
    const selectedAddress = userAddress.address.find(addr => addr._id.equals(objectId));

    if (!selectedAddress) {
      console.error("Address not found in user's record.");
      return res.status(400).json({ success: false, message: "Invalid address ID. Address not found." });
    }

    if (addressType) selectedAddress.addressType = addressType;
    if (name) selectedAddress.name = name;
    if (address) selectedAddress.address = address;
    if (city) selectedAddress.city = city;
    if (landMark) selectedAddress.landMark = landMark;
    if (state) selectedAddress.state = state;
    if (pincode) selectedAddress.pincode = pincode;
    if (phone) selectedAddress.phone = phone;
    if (altPhone) selectedAddress.altPhone = altPhone;

    await userAddress.save();


    res.json({ success: true, message: "Address updated successfully!", editData: selectedAddress });

  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};




const chooseAddress = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      console.error("Invalid Address ID:", id);
      return res.status(400).json({ success: false, message: "Invalid Address ID" });
    }

    const addressDoc = await Address.findOne({ "address._id": id });

    if (!addressDoc) {
      console.error("Address not found for ID:", id);
      return res.status(404).json({ success: false, message: "Address not found" });
    }


    await Address.updateOne(
      { _id: addressDoc._id },
      { $set: { "address.$[].status": false } }
    );

    const updated = await Address.updateOne(
      { _id: addressDoc._id, "address._id": id },
      { $set: { "address.$.status": true } }
    );

    if (updated.modifiedCount === 0) {
      return res.status(400).json({ success: false, message: "Failed to update address selection" });
    }

    res.json({ success: true, message: "Address selected successfully" });

  } catch (error) {
    console.error("Error choosing address:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};


const placeOrder = async (req, res) => {
  try {
    if (!req.session?.user?._id) {
      console.warn("User not authenticated.");
      return res.status(401).json({ success: false, message: "User not authenticated." });
    }

    const userId = req.session.user._id;
    const { paymentMethod, couponDiscount: clientCouponDiscount, totalPrice: clientTotalPrice } = req.body;

    const couponDiscount = req.session.appliedCoupon?.discountAmount || clientCouponDiscount || 0;
    const appliedCouponCode = req.session.appliedCoupon?.code || '';

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || !cart.items || cart.items.length === 0) {
      console.warn("Cart is empty.");
      return res.status(400).json({ success: false, message: "Cart is empty." });
    }

    const totalPrice = cart.items.reduce((sum, item) => {
      return sum + (item.productId?.salePrice || 0) * item.quantity;
    }, 0);

    if (clientTotalPrice && clientTotalPrice !== totalPrice) {
      console.warn("Client totalPrice mismatch:", clientTotalPrice, "vs Server:", totalPrice);
    }

    const finalAmount = Math.max(totalPrice - couponDiscount, 0);
    const user = await User.findById(userId);
    ;

    if (paymentMethod === "Cash on Delivery" && finalAmount > 1000) {
      return res.status(400).json({
        success: false, message: 'Cash on Delivery is not available for orders above ₹1000. Please select another payment method.'
      })
    }

    if (!user) {
      console.warn("User not found.");
      return res.status(400).json({ success: false, message: "User not found." });
    }

    if (paymentMethod === "Wallet Payment") {

      if (typeof user.wallet !== 'number' || user.wallet < 0) {
        console.warn("Invalid wallet balance:", user.wallet);
        return res.status(400).json({
          success: false,
          message: "Invalid wallet balance detected.",
          currentBalance: user.wallet
        });
      }

      if (user.wallet < finalAmount) {
        console.warn("Insufficient wallet balance", {
          currentBalance: user.wallet,
          requiredAmount: finalAmount
        });
        return res.status(400).json({
          success: false,
          message: "Insufficient wallet balance. Please add funds or use another payment method.",
          currentBalance: user.wallet,
          requiredAmount: finalAmount
        });
      }


      const newWalletBalance = user.wallet - finalAmount;
      if (newWalletBalance < 0) {

        console.warn("Transaction would result in negative balance", {
          currentBalance: user.wallet,
          requiredAmount: finalAmount
        });
        return res.status(400).json({
          success: false,
          message: "Transaction would result in negative wallet balance.",
          currentBalance: user.wallet,
          requiredAmount: finalAmount
        });
      }


      user.wallet = newWalletBalance;

      if (!Array.isArray(user.walletHistory)) {
        user.walletHistory = [];
      }

      user.walletHistory.push({
        transactionId: new mongoose.Types.ObjectId(),
        type: "debit",
        amount: finalAmount,
        status: "Completed",
        date: new Date()
      });

      try {
        await user.save();
        console.log("Wallet updated successfully", {
          newBalance: user.wallet,
          debitedAmount: finalAmount
        });
      } catch (err) {
        console.error("Error updating wallet balance:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to update wallet balance.",
          error: err.message
        });
      }
    }

    const address = await Address.findOne({ userId }).then((addr) => addr?._id);
    if (!address) {
      console.warn("Address not found.");
      return res.status(400).json({ success: false, message: "User address not found." });
    }

    const newOrder = new Order({
      userId,
      orderedItems: cart.items.map((item) => ({
        product: item.productId._id,
        quantity: item.quantity,
        size: item.size || "M",
        price: item.productId.salePrice,
        productImage: item.productId.productImage?.length ? item.productId.productImage : ["default-image.jpg"],
        status: "Pending",
      })),
      totalPrice,
      discount: couponDiscount,
      finalAmount,
      address,
      status: "Pending",
      paymentMethod,
      couponApplied: couponDiscount > 0,
      couponCode: appliedCouponCode
    });

    await newOrder.save();
    await Cart.deleteOne({ userId });

    req.session.orderGot = true;

    if (couponDiscount > 0 && req.session.appliedCoupon?.couponId) {
      const coupon = await Coupon.findById(req.session.appliedCoupon.couponId);
      if (coupon && !coupon.userId.includes(userId)) {
        coupon.userId.push(userId);
        await coupon.save();
        console.log(`Coupon ${req.session.appliedCoupon.couponId} marked as used by user ${userId}`);
      }
      delete req.session.appliedCoupon;
      await req.session.save();
    }

    return res.status(200).json({
      success: true,
      message: "Order placed successfully.",
      orderId: newOrder._id
    });

  } catch (error) {
    console.error("Error placing order:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};


const loadThanks = async (req, res, next) => {
  try {
    if (req.session.user && req.session.orderGot) {
      const categoryData = await Category.find({ is_Listed: true }).exec();

      const order = await Order.findOne({ userId: req.session.user._id })
        .sort({ createdOn: -1 })
        .lean();

      if (!order) {
        return res.redirect('/');
      }

      req.session.orderGot = false;

      return res.render("user/thankyou", {
        login: req.session.user,
        categoryData,
        order
      });
    }

    res.redirect('/');
  } catch (error) {
    console.error("Error in loadThanks:", error);
    next(error);
  }
};

const createRazorpayOrder = async (req, res) => {
  try {
    if (!req.session?.user?._id) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }
    const userId = req.session.user._id;
    const { paymentMethod, couponDiscount: clientCouponDiscount, totalPrice: clientTotalPrice } = req.body;

    const couponDiscount = req.session.appliedCoupon?.discountAmount || clientCouponDiscount || 0;


    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || !cart.items.length) {
      return res.status(400).json({ success: false, message: "Cart is empty or not found" });
    }

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc || addressDoc.address.length === 0) {
      return res.status(400).json({ success: false, message: "No address found." });
    }
    const defaultAddress = addressDoc.address.find(addr => addr.status) || addressDoc.address[0];
    if (!defaultAddress) {
      return res.status(400).json({ success: false, message: "No default address selected." });
    }

    const totalPrice = cart.items.reduce((sum, item) => {
      if (!item.productId?.salePrice) throw new Error(`Sale price missing for product ${item.productId?._id}`);
      if (!item.size || !["XS", "S", "M", "L", "XL", "XXL"].includes(item.size)) {
        throw new Error(`Invalid or missing size for product ${item.productId?._id}`);
      }
      if (!item.productId.productImage || !item.productId.productImage.length) {
        throw new Error(`Product image missing for product ${item.productId?._id}`);
      }
      return sum + (item.productId.salePrice * item.quantity);
    }, 0);


    if (clientTotalPrice && clientTotalPrice !== totalPrice) {
      console.warn("Client totalPrice mismatch:", clientTotalPrice, "vs Server:", totalPrice);
    }

    const finalAmount = Math.max(totalPrice - couponDiscount, 0);
    if (finalAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid order amount after discount" });
    }


    const shortUserId = userId.toString().slice(0, 12);
    const shortTimestamp = Math.floor(Date.now() / 1000).toString();
    const receipt = `ord_${shortUserId}_${shortTimestamp}`;

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: finalAmount * 100,
      currency: "INR",
      receipt: receipt,
    });

    const newOrder = new Order({
      userId,
      orderedItems: cart.items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        size: item.size,
        price: item.productId.salePrice,
        productImage: item.productImage || item.productId.productImage,
        status: "Pending",
      })),
      totalPrice,
      discount: couponDiscount,
      finalAmount,
      address: addressDoc._id,
      status: "Pending",
      paymentMethod: "razorpay",
      couponApplied: couponDiscount > 0,
    });

    await newOrder.save();


    res.status(201).json({
      success: true,
      orderId: newOrder._id,
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      finalAmount,
    });
  } catch (error) {
    console.error("Razorpay Order Creation Error:", error.stack);
    res.status(500).json({ success: false, message: "Failed to create Razorpay order", error: error.message });
  }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    console.log("Request body:", { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature });


    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      console.error("Missing required payment details");
      return res.status(400).json({ success: false, message: "Missing required payment details" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
    console.log("Signature check:", { expectedSignature, razorpaySignature });

    if (expectedSignature !== razorpaySignature) {
      console.error("Invalid payment signature");
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      console.error("Invalid orderId format:", orderId);
      return res.status(400).json({ success: false, message: "Invalid order ID format" });
    }

    const order = await Order.findById(orderId).populate("orderedItems.product");
    if (!order) {
      console.error("Order not found for ID:", orderId);
      return res.status(404).json({ success: false, message: "Order not found" });
    }


    if (order.paymentStatus === "Paid" && order.razorpayPaymentId === razorpayPaymentId) {
      console.log("Payment already verified for order:", order._id);
      return res.status(200).json({ success: true, orderId: order._id, message: "Payment already verified" });
    }

    order.status = "Pending";
    order.paymentMethod = "razorpay";
    order.razorpayPaymentId = razorpayPaymentId;
    order.paymentDetails = {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      paymentDate: new Date(),
      status: "Successful",
    };
    order.paymentStatus = "Paid";

    order.orderedItems = order.orderedItems.map(item => {
      if (item.status === "Failed") {
        console.log(`Updating item ${item.product._id} from Failed to Pending`);
        return { ...item.toObject(), status: "Pending" };
      }
      return item;
    });

    await order.save();
    for (const item of order.orderedItems) {
      const product = await Product.findById(item.product._id);
      if (!product) {
        console.error(`Product not found: ${item.product._id}`);
        throw new Error(`Product not found: ${item.product._id}`);
      }
      const sizeIndex = product.sizes.findIndex(s => s.size === item.size);
      if (sizeIndex === -1) {
        console.error(`Size ${item.size} not found for product ${item.product._id}`);
        throw new Error(`Size ${item.size} not found for product ${item.product._id}`);
      }
      const availableQuantity = product.sizes[sizeIndex].quantity;
      console.log(`Stock check: Available: ${availableQuantity}, Requested: ${item.quantity}`);
      if (availableQuantity < item.quantity) {
        console.error(`Insufficient stock for product ${item.product._id}, size ${item.size}. Available: ${availableQuantity}, Requested: ${item.quantity}`);
        throw new Error(`Insufficient stock for product ${item.product._id}, size ${item.size}. Available: ${availableQuantity}, Requested: ${item.quantity}`);
      }
      console.log(`Updating stock for product ${item.product._id}, size ${item.size}...`);
      const updatedProduct = await Product.findByIdAndUpdate(
        item.product._id,
        { $inc: { [`sizes.$[elem].quantity`]: -item.quantity, stock: -item.quantity } },
        { arrayFilters: [{ "elem.size": item.size }], new: true }
      );
      console.log(`Stock updated for product ${item.product._id}:`, updatedProduct);
    }


    const userUpdate = await User.findByIdAndUpdate(
      order.userId,
      { $push: { orderHistory: order._id } },
      { new: true }
    );
    if (!userUpdate) {
      console.error("User not found for ID:", order.userId);
      throw new Error("User not found");
    }

    const cartDelete = await Cart.deleteOne({ userId: order.userId });


    if (req.session) req.session.orderGot = true;

    console.log("Payment verification completed successfully for order:", order._id);
    res.status(200).json({
      success: true,
      orderId: order._id,
      message: "Payment verified, stock updated, and cart emptied successfully",
    });
  } catch (error) {
    console.error("Error verifying payment:", error.stack);
    res.status(500).json({
      success: false,
      message: "Payment verification and processing failed",
      error: error.message,
    });
  }
};


const handlePaymentDismissal = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOneAndUpdate(
      { orderId },
      {
        status: 'Pending',
        $push: {
          'orderedItems': {
            $each: [],
            $slice: 0,
            status: 'Failed'
          }
        },
        paymentMethod: 'razorpay'
      },
      { new: true }
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: 'Order not found' });
    }

    res.json({
      success: true,
      message: 'Order status updated to Pending due to payment dismissal',
      orderId: order.orderId,
    });
  } catch (error) {
    console.error('Error handling payment dismissal:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


const handlePaymentFailure = async (req, res) => {

  try {
    const { orderId, failureReason } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    let order = null;
    if (orderId.match(/^[0-9a-fA-F]{24}$/)) {

      order = await Order.findOneAndUpdate(
        { _id: orderId },
        {
          status: 'Failed',
          paymentMethod: 'razorpay',
          $set: {
            'orderedItems.$[].status': 'Failed'
          }
        },
        { new: true }
      );

    }

    if (!order) {
      order = await Order.findOneAndUpdate(
        { orderId: orderId },
        {
          status: 'Failed',
          paymentMethod: 'razorpay',
          $set: {
            'orderedItems.$[].status': 'Failed'
          }
        },
        { new: true }
      );

    }

    if (!order) {

      const allOrders = await Order.find({}).sort({ createdOn: -1 }).limit(5);
      console.log("Recent orders:", allOrders.map(o => ({
        _id: o._id.toString(),
        orderId: o.orderId,
        status: o.status
      })));

      return res
        .status(404)
        .json({ success: false, message: 'Order not found with ID: ' + orderId });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment failure recorded',
      orderId: order.orderId
    });
  } catch (error) {
    console.error('Error handling payment failure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to handle payment failure'
    });
  }
};

const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: 'Order ID is required' });
    }

    let order;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId)
        .populate('userId')
        .populate('orderedItems.product');
    } else {
      order = await Order.findOne({ orderId })
        .populate('userId')
        .populate('orderedItems.product');
    }

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: 'Order not found' });
    }

    if (!['Pending', 'Failed'].includes(order.status)) {
      return res
        .status(400)
        .json({ success: false, message: 'Order is not eligible for retry' });
    }

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(order.finalAmount * 100),
      currency: 'INR',
      receipt: order.orderId,
    });

    const razorpayOptions = {
      key: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      currency: 'INR',
      name: 'Laxelane',
      description: `Retry Payment for Order #${order.orderId}`,
      order_id: razorpayOrder.id,
      prefill: {
        name: order.userId.name || '',
        email: order.userId.email || '',
        contact: order.userId.phone || '',
      },
      notes: {
        orderId: order.orderId,
      },
      theme: {
        color: '#4A90E2',
      },
    };

    res.status(200).json({
      success: true,
      paymentMethod: 'razorpay',
      razorpayOptions,
    });
  } catch (error) {
    console.error('Error in retryPayment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};


const loadTransactionFailurePage = async (req, res) => {
  try {
    const { orderId } = req.query;

    if (!orderId) {
      return res
        .status(400)
        .render('user/page404', { message: 'Order ID is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).render('user/page404', { message: 'Order not found' });
    }

    res.render('user/transaction-failure', { orderId });
  } catch (error) {
    res.status(500).render('user/page404', { message: 'Server error' });
  }
};

module.exports = {
  loadCheckout,
  verifyCheckOutAddress,
  editAddressCheckout,
  addAddressCheckout,
  chooseAddress,
  placeOrder,
  loadThanks,
  createRazorpayOrder,
  verifyRazorpayPayment,
  handlePaymentDismissal,
  handlePaymentFailure,
  retryPayment,
  loadTransactionFailurePage


};
