const User=require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");

const addToCart = async (req, res) => {
    try {
        // Check if user is logged in
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).json({
                success: false,
                message: 'Please login to add items to cart'
            });
        }

        const userId = req.session.user._id;
        const { productId, quantity, size } = req.body;

        console.log("this is the condole",req.body)

        // Validate input
        if (!productId || !quantity || !size) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Find product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Calculate price (use salePrice from your product model)
        const price = product.salePrice;
        const totalPrice = price * quantity;

        // Check if user already has a cart
        let cart = await Cart.findOne({ userId });

        // Check if product already exists in cart
        if (cart) {
            const existingItem = cart.items.find(item => 
                item.productId.toString() === productId && 
                item.size === size &&
                item.status === 'placed'
            );

            if (existingItem) {
                return res.json({
                    exist: true,
                    message: 'Item already in cart'
                });
            }
        } else {
            // Create new cart if it doesn't exist
            cart = new Cart({ userId, items: [] });
        }

        // Add new item to cart
        cart.items.push({
            productId,
            name: product.productName,
            quantity,
            price,
            totalPrice,
            size,
            status: 'placed'
        });

        await cart.save();

        // Get updated cart count
        const cartCount = cart.items.length;

        return res.json({
            success: true,
            cartCount,
            message: 'Product added to cart successfully'
        });

    } catch (error) {
        console.error('Add to cart error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add item to cart'
        });
    }
};








const loadCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const userId = req.session.user;
        const categories = await Category.find({ isBlocked: false });
        
        // Find cart with populated product details
        const cartData = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            populate: { path: 'category' }
        });

        if (cartData && cartData.items.length > 0) {
            // Filter out products that are unavailable or blocked
            const unavailableProducts = cartData.items.filter(
                item => item.productId.isBlocked || item.productId.status !== "Available"
            );
            
            // Remove unavailable products from cart
            if (unavailableProducts.length > 0) {
                for (const item of unavailableProducts) {
                    await Cart.findOneAndUpdate(
                        { userId },
                        { $pull: { items: { productId: item.productId._id } } },
                        { new: true }
                    );
                }
            }
            
            // Get updated cart after removing unavailable products
            const updatedCart = unavailableProducts.length > 0 
                ? await Cart.findOne({ userId }).populate('items.productId')
                : cartData;
            
            // Calculate cart totals
            let cartTotal = 0;
            updatedCart.items.forEach(item => {
                cartTotal += item.totalPrice;
            });
            
            // Convert cart items format to match template expectations
            const cart = {
                _id: updatedCart._id,
                products: updatedCart.items.map(item => {
                    // Add 'images' property that points to 'productImage'
                    const productData = item.productId;
                    productData.images = productData.productImage;
                    
                    // Handle name difference (productName in schema but template expects name)
                    productData.name = productData.productName;
                    
                    // Handle price differences
                    productData.price = productData.regularPrice;
                    productData.discount_price = productData.salePrice;
                    productData.discount = productData.regularPrice > productData.salePrice ? 
                        productData.regularPrice - productData.salePrice : 0;
                    
                    return {
                        productId: productData,
                        quantity: item.quantity,
                        price: item.totalPrice
                    };
                }),
                coupenDiscount: 0 // Initialize to 0 or set from your coupon logic
            };
            
            return res.render('user/cart', {
                login: userId,
                categories,
                cart: cart,
                totalPrice: cartTotal
            });
        } else {
            // Return empty cart
            return res.render('user/cart', {
                login: userId,
                categories,
                cart: { products: [] },
                totalPrice: 0
            });
        }
    } catch (error) {
        console.error('Error loading cart:', error);
        // Changed error handling to use a more generic approach
        return res.status(500).redirect('/'); // Redirect to home page on error
        // Alternative: Display error message on the current page
        // return res.render('user/cart', {
        //     login: userId,
        //     categories: [],
        //     cart: { products: [] },
        //     totalPrice: 0,
        //     error: 'Failed to load cart. Please try again later.'
        // });
    }
};


// Update Cart (PUT Method)
const updateCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Please login to update cart' });
        }

        const userId = req.session.user;
        const { itemId, quantity } = req.body;
        
        if (!itemId || !quantity || quantity < 1) {
            return res.status(400).json({ success: false, message: 'Invalid update parameters' });
        }

        // Find cart and item
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const cartItem = cart.items.id(itemId);
        if (!cartItem) {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }

        // Validate product and stock availability
        const product = await Product.findById(cartItem.productId);
        if (!product || product.isBlocked || product.status !== 'Available') {
            return res.status(400).json({ success: false, message: 'Product is not available' });
        }

        // Check stock availability
        if (product.stock < quantity) {
            return res.status(400).json({ 
                success: false, 
                message: `Only ${product.stock} items available in stock` 
            });
        }

        // Update item quantity and price
        const itemPrice = cartItem.price;
        const newTotalPrice = itemPrice * quantity;

        // Update cart item
        cartItem.quantity = quantity;
        cartItem.totalPrice = newTotalPrice;

        await cart.save();

        // Calculate new cart total
        const cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

        return res.status(200).json({
            success: true,
            newItemTotal: newTotalPrice,
            cartTotal: cartTotal,
            message: 'Cart updated successfully'
        });
    } catch (error) {
        console.error('Error updating cart:', error);
        return res.status(500).json({ success: false, message: 'Failed to update cart' });
    }
};

module.exports = {
    addToCart,
    loadCart,
    updateCart
}

// // Delete from Cart (DELETE Method)
// const deleteCart = async (req, res) => {
//     try {
//         if (!req.session.user) {
//             return res.status(401).json({ success: false, message: 'Please login to remove items' });
//         }

//         const userId = req.session.user;
//         const { itemId } = req.body;

//         if (!itemId) {
//             return res.status(400).json({ success: false, message: 'Item ID is required' });
//         }

//         // Find cart
//         const cart = await Cart.findOne({ userId });
//         if (!cart) {
//             return res.status(404).json({ success: false, message: 'Cart not found' });
//         }

//         // Remove item from cart
//         cart.items = cart.items.filter(item => item._id.toString() !== itemId);
        
//         // Save updated cart
//         await cart.save();

//         // Calculate new cart total
//         const cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

//         // Return appropriate response based on cart state
//         if (cart.items.length === 0) {
//             return res.status(200).json({ 
//                 success: true, 
//                 empty: true,
//                 cartTotal: 0,
//                 message: 'Cart is now empty' 
//             });
//         } else {
//             return res.status(200).json({ 
//                 success: true, 
//                 cartTotal: cartTotal,
//                 message: 'Item removed from cart' 
//             });
//         }
//     } catch (error) {
//         console.error('Error removing from cart:', error);
//         return res.status(500).json({ success: false, message: 'Failed to remove item from cart' });
//     }
// };

