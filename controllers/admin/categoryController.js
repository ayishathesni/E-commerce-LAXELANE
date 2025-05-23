const { compareSync } = require("bcrypt");
const Category=require("../../models/categorySchema");
const Product=require("../../models/productSchema");



const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";
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
            search: search, 
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
           
            const existingCategory = await Category.findOne({ name: { $regex: new RegExp("^" + name + "$", "i") } });
            if(existingCategory){
                return res.status(400).json({error:"Category already exists"})
            }

            
            const newCategory= new Category({
                name,
                description,
            })
          
            await newCategory.save();
            return res.json({message:"Category added succesfully"})

        } catch (error) {
            return res.status(500).json({error:"Internal Server Error"})
            
        }
    }



 
const addCategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }
        if (percentage >= 100) {
            return res.status(404).json({ status: false, message: "percentage should be below 100" });
        }
        const Products = await Product.find({ category: category._id });
        const hasLowerProductOffer = Products.some((product) => product.productOffer < percentage);

        if (!hasLowerProductOffer) {
            return res.json({ status: false, message: "None of the products have a lower offer than the category offer. Category offer will not be applied." });
        }
        await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });
        for (const product of Products) {
            if (product.productOffer < percentage) {
                product.productOffer = percentage;
                product.salePrice = product.regularPrice * (1 - (percentage / 100)); 
            }
            await product.save();
        }

        res.json({ status: true });

    } catch (error) {
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};



    
const removeCategoryOffer = async (req, res) => {
    try {
        console.log("🔹 Request received to remove offer for category:", req.body.categoryId);

        const categoryId = req.body.categoryId;
        const category = await Category.findById(categoryId);

        if (!category) {
            console.log(" Category not found:", categoryId);
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        console.log("Category found:", category.name);

        const percentage = category.categoryOffer;
        const products = await Product.find({ category: category._id });

        console.log(`🔹 Found ${products.length} products in this category.`);

        if (products.length > 0) {
            for (const product of products) {
                console.log(`🔹 Updating product: ${product.name}`);
                product.salePrice += Math.floor(product.regularPrice * (percentage / 100));
                product.productOffer = 0;
                await product.save();
            }
        }

        category.categoryOffer = 0;
        await category.save();
        

        res.json({ status: true });

    } catch (error) {
        console.error("Internal Server Error:", error);
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};




    const getListCategory = async(req,res)=>{
        try {
            let id = req.query.id;
           

            await Category.updateOne({_id:id},{$set:{isListed:false}});
            res.redirect("/admin/category");
        } catch (error) {
            res.redirect("/pageerror");
        }
    }

    const getUnlistCategory = async(req,res)=>{
        try {
            let id = req.query.id;
            
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