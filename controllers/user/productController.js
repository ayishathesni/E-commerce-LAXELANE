const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const User = require('../../models/userSchema')

const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.params.id;
        const getProduct = await Product.findById(productId).populate('category');
        
        
        if (!getProduct) {
            return res.redirect('/pageNotFound');
        }

        let relatedProducts = await Product.find({
            category: getProduct.category._id,
            _id: { $ne: getProduct._id },
            isBlocked: false,
            status: "Available"
        })
        .populate('category')
        .limit(8)
        .lean();



        if (relatedProducts.length < 8) {
            let additionalProducts = await Product.find({
                color: getProduct.color,
                _id: { $ne: getProduct._id },
                isBlocked: false,
                status: "Available"
            })
            .populate('category')
            .limit(8 - relatedProducts.length)
            .lean();

          

          
            const uniqueProducts = new Map();
            [...relatedProducts, ...additionalProducts].forEach(product => {
                uniqueProducts.set(product._id.toString(), product);
            });

            relatedProducts = Array.from(uniqueProducts.values());
        }

      

       
        res.render('user/singleDetails', {
            product: getProduct,
            relatedProducts: relatedProducts,
            login: userId
        });

    } catch (error) {
        console.error('Error fetching product details:', error);
        res.redirect('/pageNotFound');
    }
};






module.exports={
    productDetails,
}