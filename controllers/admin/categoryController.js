const { compareSync } = require("bcrypt");
const Category=require("../../models/categorySchema");
const Product=require("../../models/productSchema");


// const categoryInfo = async(req,res)=>{
//     try {
//       const page=parseInt(req.query.page) || 1;
//       const limit=4;
//       const skip=(page-1)*limit;
//       const categoryData = await Category.find({})
//       .sort({createdAt:-1}) 
//       .skip(skip)
//       .limit(limit)

//       const totalCategories = await Category.countDocuments();
//       const totalPages=Math.ceil(totalCategories/limit);
//       res.render("admin/category",{
//         cat:categoryData,
//         currentPage:page,
//         totalPages:totalPages,
//         totalCategories:totalCategories
//       });
//     } catch (error) {
//         console.log(error);
//         res.redirect("/pageeror")
  
//     }
// }
const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const search = req.query.search || ""; // Get search query

        // Search with case-insensitive regex
        const categoryData = await Category.find({ 
            name: { $regex: search, $options: "i" } 
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        const totalCategories = await Category.countDocuments({
            name: { $regex: search, $options: "i" } 
        });

        const totalPages = Math.ceil(totalCategories / limit);

        res.render("admin/category", {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            search: search, // Pass search term to keep it in input field
        });
    } catch (error) {
        console.log(error);
        res.redirect("/pageerror");
    }
};


    const addCategory=async(req,res)=>{
        let {name,description} = req.body;
        try {
            name = name.trim();
            // const existingCategory = await Category.findOne({name});
            const existingCategory = await Category.findOne({ name: { $regex: new RegExp("^" + name + "$", "i") } });
            if(existingCategory){
                return res.status(400).json({error:"Category already exists"})
            }

            console.log("existingCategory")
            const newCategory= new Category({
                name,
                description,
            })
            console.log()
            await newCategory.save();
            return res.json({message:"Category added succesfully"})

        } catch (error) {
            return res.status(500).json({error:"Internal Server Error"})
            
        }
    }



    const addCategoryOffer = async (req,res)=>{
        try {
           const percentage = parseInt(req.body.percentage);
           const categoryId = req.body.categoryId;
           console.log('categoryId',categoryId)
           const category= await Category.findById(categoryId);
           if(!category){
            return res.status(404).json({status:false,message:"Category not found"});
           } 
           const products = await Product.find({category:category._id});
           consolelog('product',products)
           const hasProductOffer = products.some((product)=>product.productOffer > percentage);
           if(hasProductOffer){
            return res.json({status:false,message:"Products with this category already have product offers"})
           }
           await Category.updateOne({_id:categoryId},{$set:{categoryOffer:percentage}});
           for(const product of products){
            product.productOffer = 0;
            product.salePrice = product.regularPrice;
            await product.save();
           }
           res.json({status:true});

        } catch (error) {
            res.status(500).json({status:false, message:"Internal Server Error"})
            
        }
    };



    const removeCategoryOffer = async (req,res)=>{
        try {
           
           const categoryId = req.body.categoryId;
           const category= await Category.findById(categoryId);
           if(!category){
            return res.status(404).json({status:false,message:"Category not found"});
           } 
           const percentage=category.categoryOffer;
           const products = await Product.find({category:category._id});
          
           if(products.length>0){
           for(const product of products){
            product.salePrice += Math.floor(product.regularPrice * (percentage/100));
            product.productOffer = 0;
            await product.save();
           }
        }
           category.categoryOffer = 0;
           await category.save();
           res.json({status:true});

        } catch (error) {
            res.status(500).json({status:false, message:"Internal Server Error"})
            
        }
    }


    const getListCategory = async(req,res)=>{
        try {
            let id = req.query.id;
            console.log("islisted id",id)

            await Category.updateOne({_id:id},{$set:{isListed:false}});
            res.redirect("/admin/category");
        } catch (error) {
            res.redirect("/pageerror");
        }
    }

    const getUnlistCategory = async(req,res)=>{
        try {
            let id = req.query.id;
            console.log("isunlisted id",id)
            await Category.updateOne({_id:id},{$set:{isListed:true}});
            res.redirect("/admin/category");
        } catch (error) {
            res.redirect("/pageerror");
        }
    }
 
    const getEditCategory = async(req,res)=>{
        try {
            const id = req.query.id;
            const category = await Category.findOne({_id:id});
            res.render("admin/edit-category",{category:category}); 
        } catch (error) {
            res.redirect("/pageerror")
            
        }
    };

  const editCategory = async(req,res)=>{
    try {
        const id = req.params.id;
        const {categoryName,description} = req.body;
        const existingCategory = await Category.findOne({name:categoryName});
        if(existingCategory){
            return res.status(400).json({error:"Category exists,please choose another name"})
        }
        const updateCategory = await Category.findByIdAndUpdate(id,{
            name:categoryName,
            description:description,
        },{new:true});
        if(updateCategory){
           res.redirect("/admin/category"); 
        }else{
            res.status(404).json({error:"Category not found"})
        }
    } catch (error) {
        res.status(500).json({error:"Internal server error"})
        
    }
  }


    module.exports={
        categoryInfo,
        addCategory,
        addCategoryOffer, 
        removeCategoryOffer,
        getListCategory,
        getUnlistCategory,
        getEditCategory,
        editCategory
    }