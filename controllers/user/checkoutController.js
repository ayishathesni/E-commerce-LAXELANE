const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");  
const Coupon = require("../../models/couponSchema");  
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

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
      totalCartPrice
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
    console.log("Received Data:", req.body); 

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
      console.log("Incoming Edit Request:", req.body); 
      console.log("Session User ID:", req.session.user);

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
      console.log("Fetched User Address:", userAddress);

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
      console.log("Updated Address:", selectedAddress);

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
      return res.status(401).json({ success: false, message: "User not authenticated." });
    }

    const userId = req.session.user._id;
    const { paymentMethod, couponDiscount = 0 } = req.body;

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty." });
    }

    for (let item of cart.items) {
      const product = await Product.findById(item.productId._id);
      const sizeIndex = product.sizes.findIndex(s => s.size === item.size);

      if (sizeIndex === -1 || product.sizes[sizeIndex].quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.sizes[sizeIndex]?.quantity || 0} items left in size ${item.size}.`
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} items available for ${product.productName}.`
        });
      }
    }

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc || addressDoc.address.length === 0) {
      return res.status(400).json({ success: false, message: "No address found." });
    }

    const defaultAddress = addressDoc.address.find(addr => addr.status);
    if (!defaultAddress) {
      return res.status(400).json({ success: false, message: "No default address selected." });
    }

   
    const totalPrice = cart.items.reduce((sum, item) => {
      return sum + (item.productId.salePrice * item.quantity);
    }, 0);
    const finalAmount = Math.max(totalPrice - couponDiscount, 0);

   
    const newOrder = new Order({
      userId,
      orderedItems: cart.items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        size: item.size || "M",
        price: item.productId.salePrice,
        productImage: item.productId.productImage?.length ? item.productId.productImage : ["default-image.jpg"],
        status: "Pending"
      })),
      totalPrice,
      discount: couponDiscount,
      finalAmount,
      address: addressDoc._id,
      status: "Pending",
      paymentMethod,
      couponApplied: couponDiscount > 0
    });

  
    await Promise.all(
      cart.items.map(async (item) => {
        const product = await Product.findById(item.productId._id);
        const sizeIndex = product.sizes.findIndex(s => s.size === item.size);
        if (sizeIndex >= 0) {
          product.sizes[sizeIndex].quantity = Math.max(product.sizes[sizeIndex].quantity - item.quantity, 0);
        }
        product.stock = Math.max(product.stock - item.quantity, 0);
        await product.save();
      })
    );

    await newOrder.save();
    await Cart.deleteOne({ userId });

    req.session.orderGot = true;
    res.status(200).json({ success: true, message: "Order placed successfully.", orderId: newOrder._id });

  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};




const loadThanks = async (req, res, next) => {
  try {
    if (req.session.user && req.session.orderGot) {
      const categoryData = await Category.find({ is_Listed: true }).exec();
      
      const order = await Order.findOne({
        userId: req.session.user._id
      }).sort({ createdOn: -1 }).limit(1);
      
      if (!order) {
        return res.redirect('/');
      }
      req.session.orderGot = false;
      
      return res.render("user/thankyou", {
        login: req.session.user,
        categoryData,
        order: order
      });
    }
    
    res.redirect('/');
  } catch (error) {
    next(error);
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
  

};
