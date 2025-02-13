const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const User = require('../../models/userSchema')


const productDetails=async (req,res)=>{
    try {

        const userId = req.session.user
        

        
        const productId = req.params.id
       

        const getProduct = await Product.findById(productId)
        console.log("productdetatals",getProduct)
        
        res.render('user/singleDetails',{
          
            product:getProduct,
            login:userId
        })
         
        
    } catch (error) {

    console.error('Error for fetching product details');
    res.redirect('/pageNotFound')
    
        
    }
}


module.exports={
    productDetails,
}