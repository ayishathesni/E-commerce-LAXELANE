const User=require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const mongoose = require("mongoose");

const addToCart = async (req, res) => {
    try {
        if (!req.session?.user?._id) {
            return res.status(401).json({
                success: false,
                message: 'Please login to add items to cart'
            });
        }

        const userId = req.session.user._id;
        const { productId, quantity, size } = req.body;

        if (!productId || !quantity || !size) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: productId, quantity, or size'
            });
        }

        const product = await Product.findById(productId);
        if (!product || product.isBlocked) {
            return res.status(400).json({
                success: false,
                message: 'This product is not available.'
            });
        }

        const selectedSize = product.sizes.find(s => s.size === size);
        if (!selectedSize) {
            return res.status(400).json({
                success: false,
                message: `Invalid size selection. Available sizes: ${product.sizes.map(s => s.size).join(', ')}` 
            });
        }

        if (quantity > selectedSize.quantity) {
            return res.status(400).json({
                success: false,
                message: `Only ${selectedSize.quantity} left in stock`
            });
        }

        const price = product.salePrice;
        const totalPrice = price * quantity;

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const existingItem = cart.items.find(item => 
            item.productId.toString() === productId &&
            item.size === size &&
            item.status === 'placed'
        );

        if (existingItem) {
            return res.status(400).json({
                success: false,
                message: `This item is already in your cart. You can update the quantity from the cart page.`
            });
        } else {
            cart.items.push({
                productId,
                name: product.productName,
                quantity: parseInt(quantity),
                price,
                totalPrice,
                size,
                status: 'placed'
            });
        }

        await cart.save();

        await Wishlist.findOneAndUpdate(
            { userId },
            { $pull: { products: { productId: new mongoose.Types.ObjectId(productId) } } }, 
            { new: true }
        );

        return res.json({
            success: true,
            cartCount: cart.items.length,
            message: 'Product added to cart successfully and removed from wishlist'
        });

    } catch (error) {
        console.error('Error in addToCart:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add item to cart',
            error: error.message
        });
    }
};






const loadCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const userId = req.session.user._id;
        const categories = await Category.find({ isBlocked: false });

        const cartData = await Cart.findOne({ userId }).populate('items.productId');

        if (!cartData || cartData.items.length === 0) {
            return res.render('user/cart', {
                login: userId,
                categories,
                cart: { items: [] },
                maxQuantities: []
            });
        }

      
        const filteredItems = cartData.items.filter(item => {
            return item.productId && !item.productId.isBlocked;
        });

      
        if (filteredItems.length !== cartData.items.length) {
            cartData.items = filteredItems;
            await cartData.save(); 
        }

        if (filteredItems.length === 0) {
            return res.render('user/cart', {
                login: userId,
                categories,
                cart: { items: [] },
                maxQuantities: []
            });
        }

      
        const maxQuantities = filteredItems.map(item => {
            const selectedSize = item.size;
            const sizeInfo = item.productId?.sizes?.find(s => s.size === selectedSize);
            return sizeInfo ? sizeInfo.quantity : 0;
        });

        return res.render('user/cart', {
            login: userId,
            categories,
            cart: { ...cartData.toObject(), items: filteredItems },
            maxQuantities
        });

    } catch (error) {
        console.error('Error loading cart:', error);
        return res.status(500).redirect('/');
    }
};










const cartUpdate = async (req, res) => {
   
    const { quantity, cartId, proId, size,price } = req.body;
    console.log("Received Request:", { quantity, cartId, proId, size,price });
  
    try {
   
      if (!mongoose.Types.ObjectId.isValid(cartId)) {
        return res.json({ success: false, message: "Invalid cart ID format" });
      }
      if (!mongoose.Types.ObjectId.isValid(proId)) {
        return res.json({ success: false, message: "Invalid product ID format" });
      }
  
      const cart = await Cart.findById(cartId);
      if (!cart) return res.json({ success: false, message: "Cart not found" });
  
      const product = await Product.findById(proId);
      if (!product) return res.json({ success: false, message: "Product not found" });
  

      const selectedSize = (size && size.trim().toUpperCase()) || "N/A";
      
  
      const sizeData = product.sizes.find(s => s.size.toUpperCase() === selectedSize);
      if (!sizeData) {
        return res.json({ success: false, message: "Invalid size selected" });
      }
  
      if (quantity > sizeData.quantity) {
        return res.json({ success: false, message: "Not enough stock available for this size!" });
      }
  
   
      const selectedPrice = Number(product.salePrice || product.regularPrice || 0);
      if (isNaN(selectedPrice) || selectedPrice <= 0) {
        return res.json({ success: false, message: "Invalid price for selected product" });
      }
  
      const selectedName = product.name;
  
      const itemIndex = cart.items.findIndex(
        item =>
          item.productId.toString() === proId &&
          (item.size && item.size.trim().toUpperCase()) === selectedSize
      );
  
     
  
      if (itemIndex !== -1) {
        cart.items[itemIndex].quantity = quantity;
        cart.items[itemIndex].price = selectedPrice;
        cart.items[itemIndex].totalPrice = quantity * selectedPrice;
        
      } else {
        cart.items.push({
          productId: proId,
          name: selectedName,
          size: selectedSize,
          quantity,
          price: selectedPrice,
          totalPrice: quantity * selectedPrice,
          status: "placed",
          cancellationReason: "none"
        });
      
      }
  
      const subTotal = cart.items.reduce((acc, item) => acc + (Number(item.totalPrice) || 0), 0);
      const totalPrice = subTotal;
  
      await cart.save();

      console.log("Updated cart saved:", {
        items: cart.items.map(item => ({
          productId: item.productId,
          size: item.size,
          quantity: item.quantity,
          totalPrice: item.totalPrice
        })),
        totalPrice: cart.totalPrice || subTotal,
        subTotal: cart.subTotal || subTotal
      });
  
      return res.json({
        success: true,
        productPrice: quantity * selectedPrice,
        subTotal,
        totalPrice
      });
  
    } catch (err) {
      console.error("Cart Update Error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
  

  







const deleteCart = async (req, res) => {
    if (!req.session?.user?._id) {
        return res.status(401).json({ success: false, message: "Please login to remove items" });
    }

    const userId = req.session.user._id;
    const { productId, size } = req.body;

    if (!productId || !size) {
        return res.status(400).json({ success: false, message: "Product ID and size are required" });
    }

    try {
        const result = await Cart.updateOne(
            { userId },
            { $pull: { items: { productId, size } } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: "Item not found in cart or already removed" });
        }
        return res.status(200).json({ success: true, message: "Item removed from cart successfully" });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to remove item from cart." });
    }
};





module.exports = {
    addToCart,
    loadCart,
    cartUpdate,
    deleteCart
}
