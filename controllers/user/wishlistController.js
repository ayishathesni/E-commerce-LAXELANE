const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Wishlist = require('../../models/wishlistSchema')
const Cart = require('../../models/cartSchema')
const mongoose = require('mongoose');


const loadWishlist = async (req,res)=>{
    try {

        const userId = req.session.user
        const user = await User.findById(userId)

        if(!user){
            return res.redirect("/login");
        }

        const wishlist = await Wishlist.findOne({userId:userId}).populate('products.productId')
        const products = wishlist ? wishlist.products : [];

        res.render('user/wishlist',{
            user,
            wishlist

        })
        
    } catch (error) {

        console.error("Error in getWishlist:", error);
        res.status(500).send('There is an error');
        

    }
}



const addWishlist = async (req, res) => {
    try {
      
      const user = req.session.user;
      const { productId } = req.body;
     
  
      if (!user || !user._id) {
        return res.status(401).json({ success: false, message: 'Please log in to add to wishlist' });
      }
  
      const userId = user._id;
  
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ success: false, message: 'Invalid product ID' });
      }
  
      let wishlist = await Wishlist.findOne({ userId });
      
  
      if (!wishlist) {
    
        wishlist = new Wishlist({
          userId,
          products: [{ productId }]
        });
  
        await wishlist.save();
  
        const userDoc = await User.findById(userId);
        if (userDoc && !userDoc.wishlist.includes(wishlist._id)) {
          userDoc.wishlist.push(wishlist._id);
          await userDoc.save();
         
        }
  
      } else {
        const productExists = wishlist.products.some(
          item => item.productId.toString() === productId
        );
  
        if (productExists) {
          return res.status(400).json({ success: false, message: 'Product already in wishlist' });
        }
  
        wishlist.products.push({ productId });
        await wishlist.save();
      }
  
      return res.status(200).json({ success: true, message: 'Product added to wishlist' });
  
    } catch (error) {
      console.error(' Error in addWishlist:', error);
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  };

  const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.query.productId; 

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Please log in to remove from wishlist'
            });
        }

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
        }

        const size = req.query.size;

        const removedWishlist = await Wishlist.findOneAndUpdate(
            { userId: userId },
            { $pull: { products: { productId: new mongoose.Types.ObjectId(productId),} } },
            { new: true }
        ).populate("products.productId");
        
        if (!removedWishlist) {
            return res.status(404).json({
                success: false,
                message: 'Wishlist not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Product removed from wishlist successfully',
            wishlist: removedWishlist.products
        });

    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while removing from wishlist',
            error: error.message
        });
    }
};



module.exports = {
    loadWishlist,
    addWishlist,
    removeFromWishlist
}