
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");  
const Coupon = require("../../models/couponSchema");  

const applyCoupon = async (req, res) => {
    try {
      const { couponCode, orderTotal } = req.body;
      const userId = req.session.user?._id;
  
      if (!userId) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
      }
  
      const coupon = await Coupon.findOne({
        name: couponCode,
        isList: true,
        expireOn: { $gt: new Date() },
      });
  
      if (!coupon) {
        return res.status(404).json({ success: false, message: "Coupon not found or expired" });
      }
  
      if (coupon.userId.includes(userId)) {
        return res.status(400).json({
          success: false,
          message: "You have already used this coupon and cannot apply it again.",
        });
      }
  
      if (orderTotal < coupon.minimumPrice) {
        return res.status(400).json({
          success: false,
          message: `Minimum order amount of ₹${coupon.minimumPrice} required`,
        });
      }
  
      const discountAmount = Math.min(coupon.offerPrice, orderTotal);
      const newTotal = orderTotal - discountAmount;
  
      // Store the coupon data in the session
      req.session.appliedCoupon = {
        couponId: coupon._id,
        discountAmount,
        couponCode,
      };
      await req.session.save(); // Ensure session is saved
  
      res.json({
        success: true,
        newTotal,
        discountAmount,
        message: "Coupon applied successfully!",
      });
    } catch (error) {
      console.error("Error applying coupon:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  };


const removeCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const userId = req.session.user;


        if (!userId) {
            console.log('User not found in session');
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!couponCode) {
            console.log('Coupon code not provided');
            return res.status(400).json({
                success: false,
                message: 'Coupon code is required'
            });
        }

        const coupon = await Coupon.findOne({ name: couponCode });

        if (!coupon) {
            console.log('Coupon not found:', couponCode);
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        await Coupon.updateOne({ _id: coupon._id }, { $pull: { userId: userId } });

        // Clear the applied coupon from session
        delete req.session.appliedCoupon;
        await req.session.save();
    
        res.json({ success: true, message: "Coupon removed successfully" });
    } catch (error) {
        console.error('Error in removeCoupon:', error);
        res.status(500).json({
            success: false,
            message: 'Cannot remove the coupon'
        });
    }
};

module.exports ={
    applyCoupon,
    removeCoupon
}