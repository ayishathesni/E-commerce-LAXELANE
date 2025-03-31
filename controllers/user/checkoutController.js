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
  key_id:process.env.RAZORPAY_KEY_ID,
  key_secret:process.env.RAZORPAY_KEY_SECRET
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
      couponDiscount:req.session?.appliedCoupon?.couponDiscount
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
    if (!user) {
      console.warn(" User not found.");
      return res.status(400).json({ success: false, message: "User not found." });
    }

  

    if (paymentMethod === "Wallet Payment") {
      if (user.wallet < finalAmount) {
        console.warn("Insufficient Wallet Balance.");
        return res.status(400).json({ success: false, message: "Insufficient wallet balance." });
      }

      user.wallet -= finalAmount;

      if (!Array.isArray(user.walletHistory)) {
        user.walletHistory = [];
      }

      user.walletHistory.push({
        transactionId: new mongoose.Types.ObjectId(),
        type: "debit",
        amount: finalAmount,
        status: "Completed",
      });

      try {
        await user.save();
      } catch (err) {
        console.error("Error updating wallet balance:", err);
        return res.status(500).json({ success: false, message: "Failed to update wallet balance.", error: err.message });
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
      couponCode:appliedCouponCode
    });

    await newOrder.save();
    await Cart.deleteOne({ userId });

    req.session.orderGot = true;
   
    if (couponDiscount > 0 && req.session.appliedCoupon?.couponId) {
      const coupon = await Coupon.findById(req.session.appliedCoupon.couponId);
      if (coupon) {
        if (!coupon.userId.includes(userId)) {
          coupon.userId.push(userId); 
          await coupon.save();
          console.log(` Coupon ${req.session.appliedCoupon.couponId} marked as used by user ${userId}`);
        } else {
          console.log(` Coupon ${req.session.appliedCoupon.couponId} is already used by user ${userId}`);
        }
      } else {
        console.warn("Coupon not found in database.");
      }
      delete req.session.appliedCoupon; 
      await req.session.save();
    }

    return res.status(200).json({ success: true, message: "Order placed successfully.", orderId: newOrder._id });

  } catch (error) {
    console.error("Error placing order:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
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


      if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
          return res.status(400).json({ success: false, message: "Missing required payment details" });
      }

      const expectedSignature = crypto
          .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest("hex");

      if (expectedSignature !== razorpaySignature) {
          return res.status(400).json({ success: false, message: "Invalid payment signature" });
      }
      const order = await Order.findOneAndUpdate(
        { _id: orderId },
        {
            status: "Pending",
            paymentMethod: "razorpay",
            razorpayPaymentId: razorpayPaymentId,
            paymentDetails: {
                razorpayOrderId,
                razorpayPaymentId,
                razorpaySignature,
                paymentDate: new Date(),
                status: "Successful"
            },
            paymentStatus: "Paid"
        },
        { new: true }
    );

      if (!order) {
          console.error("Order not found for ID:", orderId);
          return res.status(404).json({ success: false, message: "Order not found" });
      }

     

      if (order.paymentStatus === "Paid" && order.razorpayPaymentId) {
          return res.status(200).json({ success: true, orderId: order._id, message: "Payment already verified" });
      }

      for (const item of order.orderedItems) {
          const product = await Product.findById(item.product);
          if (!product) throw new Error(`Product not found: ${item.product}`);
          const sizeIndex = product.sizes.findIndex(s => s.size === item.size);
          if (sizeIndex === -1) throw new Error(`Size ${item.size} not found for product ${item.product}`);
          const availableQuantity = product.sizes[sizeIndex].quantity;
          if (availableQuantity < item.quantity) {
              throw new Error(`Insufficient stock for product ${item.product}, size ${item.size}. Available: ${availableQuantity}, Requested: ${item.quantity}`);
          }
          await Product.findByIdAndUpdate(
              item.product,
              { $inc: { [`sizes.$[elem].quantity`]: -item.quantity, stock: -item.quantity } },
              { arrayFilters: [{ "elem.size": item.size }], new: true }
          );
      }

      await User.findByIdAndUpdate(order.userId, { $push: { orderHistory: order._id } });
      await Cart.deleteOne({ userId: order.userId });

      if (req.session) req.session.orderGot = true;

      res.status(200).json({ success: true, orderId: order._id, message: "Payment verified, stock updated, and cart emptied successfully" });
  } catch (error) {
      console.error("Error verifying payment:", error.stack);
      res.status(500).json({ success: false, message: "Payment verification and processing failed", error: error.message });
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
    verifyRazorpayPayment
  

};
