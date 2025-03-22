const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")
const User = require("../../models/userSchema");
const fs = require("fs");
const path = require("path");
const Sharp = require("sharp");


const getProductAddPage = async(req,res)=>{
    try {
        const category = await Category.find({isListed:true});
        const brand = await Brand.find({isBlocked:false});
        res.render("admin/product-add",{
            cat:category,
            brand:brand
        })
    } catch (error) {
        res.redirect("/pageerror")
    }
}




const addProducts = async (req, res) => {
    try {
        const products = req.body;
        

        const productExists = await Product.findOne({ productName: products.productName });

        if (!productExists) {
            const images = [];

            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const OriginalImagesPath = req.files[i].path;
                    const resizedImagePath = path.join('public', 'uploads', 'product-image', req.files[i].filename);
                    await Sharp(OriginalImagesPath)
                        .resize({ width: 440, height: 440 })
                        .toFile(resizedImagePath);
                    images.push(req.files[i].filename);
                }
            }

       
            const categoryId = await Category.findOne({ name: products.category });
            if (!categoryId) {
                return res.status(400).json({ message: "Invalid category name" });
            }

         
            let formattedSizes = [];
            if (products.sizes) {
                try {
                    const sizesData = JSON.parse(products.sizes);
                    formattedSizes = sizesData.map(sizeData => ({
                        size: sizeData.size,
                        quantity: parseInt(sizeData.quantity) 
                    }));
                } catch (error) {
                    console.error("Error parsing sizes:", error);
                    return res.status(400).json({ 
                        message: "Invalid sizes format",
                        error: error.message 
                    });
                }
            }

          
            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                brand: products.brand,
                category: categoryId._id,
                regularPrice: parseFloat(products.regularPrice),
                salePrice: parseFloat(products.salePrice),
                sizes: formattedSizes,
                color: products.color,
                productImage: images,
                status: formattedSizes.some(size => size.quantity > 0) ? 'Available' : 'out of stock'
            });
            
            await newProduct.save();
            
           
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.json({ success: true });
            } else {
                return res.redirect("/admin/addProducts");
            }

        } else {
            return res.status(400).json({ 
                message: "Product already exists, please try with another name" 
            });
        }

    } catch (error) {
        console.error("Error saving product:", error);
       
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ 
                success: false, 
                message: "Error saving product",
                error: error.message 
            });
        } else {
            return res.redirect("/admin/pageerror");
        }
    }
};

const getAllProducts = async(req,res)=>{
    try {
       const search = req.query.search || "";
       const page = req.query.page || 1;
       const limit = 4;

       const productData = await Product.find({
        $or:[
            {productName:{$regex:new RegExp(".*"+search+".*","i")}},
            {brand:{$regex:new RegExp(".*"+search+".*","i")}},

        ],
       }).limit(limit*1).skip((page-1)*limit).populate('category').exec();

       const count = await Product.find({
        $or:[
            {productName:{$regex:new RegExp(".*"+search+".*","i")}},
            {brand:{$regex:new RegExp(".*"+search+".*","i")}},

        ],

       }).countDocuments();

       const category = await Category.find({isListed:true});
       const brand = await Brand.find({isBlocked:false});

       if(category && brand){
        res.render("admin/products",{
            data:productData,
            currentPage:page,
            totalPages:page,
            totalPages:Math.ceil(count/limit),
            cat:category,
            brand:brand,

        })
       }else{
        res.render("page-404");
       }

    } catch (error) {
        res.redirect("/pageerror");
        res.status(500).json({status:false,message:"Internal Server Error"});   
    }
}

const addProductOffer = async (req,res) => {
 try {
    const {productId,percentage} = req.body;
    const findProduct = await Product.findOne({id:productId});
    const findCategory = await Category.findOne({id:findProduct.category});
    if(findCategory.categoryOffer>percentage){
        return res.json({status:false,message:"This Products category already has a category offer"})
    }

    findProduct.salePrice = findProduct.salePrice-Math.floor(findProduct.regularPrice*(percentage/100))
    findProduct.productOffer = parseInt(percentage);
    await findProduct.save();
    findCategory.categoryOffer=0;
    await findCategory.save();
    res.json({status:true});
 } catch (error) {
    res.redirect("/pageerror");
    res.status(500).json({status:false,message:"Internal Server Error"});
    
 }   
}

const removeProductOffer = async (req,res) => {
    try {
       const {productId} = req.body;
       const findProduct = await Product.findOne({id:productId});
       const percentage = findProduct.percentage;
       
       findProduct.salePrice = findProduct.salePrice-Math.floor(findProduct.regularPrice*(percentage/100))
       findProduct.productOffer = 0;
       await findProduct.save();
       res.json({status:true});
    } catch (error) {
       res.redirect("/pageerror");

       
    }   
   }


   const blockProduct = async (req,res) => {
    try {
        let id = req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("/admin/products")
    } catch (error) {
        res.redirect("/pageerror");
    }
    
   }


   const unblockProduct = async (req,res) => {
    try {
        let id = req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/products")
    } catch (error) {
        res.redirect("/pageerror");
    }
    
   }


const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
      
        const product = await Product.findOne({ _id: id }).populate('category');
    
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isBlocked: false });

        if (!product || !categories || !brands) {
            return res.redirect("/pageerror");
        }

        res.render("admin/edit-product", {
            product: product,
            category: categories, 
            brand: brands,
        });
    } catch (error) {
        console.error("Error in getEditProduct:", error);
        res.redirect("/pageerror");
    }
};
const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        
        
        const product = await Product.findOne({ _id: id });
        const data = req.body;
        
       
        
        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        });

        if (existingProduct) {
            return res.status(400).json({ 
                error: "Product with this name already exists. Please try with another name" 
            });
        }

        let updatedImages = [...product.productImage]; 
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => file.filename);
            updatedImages = [...updatedImages, ...newImages];
        }

        let updatedSizes = [...product.sizes]; 
        if (data.sizes) {
            try {
                const newSizes = JSON.parse(data.sizes);
              
                const existingSizeMap = new Map(
                    product.sizes.map(size => [size.size, size])
                );

                newSizes.forEach(newSize => {
                    const existingSize = existingSizeMap.get(newSize.size);
                    if (existingSize) {
                        existingSize.quantity = parseInt(newSize.quantity);
                    } else {
                        updatedSizes.push({
                            size: newSize.size,
                            quantity: parseInt(newSize.quantity)
                        });
                    }
                });

              
                updatedSizes = updatedSizes.filter(size => 
                    newSizes.some(newSize => newSize.size === size.size)
                );

            } catch (error) {
                console.error("Error parsing sizes:", error);
                return res.status(400).json({ message: "Invalid sizes format" });
            }
        }

        const updateFields = {
            productName: data.productName,
            description: data.description,
            brand: data.brand,
            category: data.category,
            regularPrice: data.regularPrice,
            salePrice: data.salePrice,
            sizes: updatedSizes,
            color: data.color,
            productImage: updatedImages,        
            status: updatedSizes.some(size => size.quantity > 0) ? 'Available' : 'out of stock'
        };

   
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            updateFields,
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            res.json({ 
                success: true, 
                message: "Product updated successfully",
                product: updatedProduct 
            });
        } else {
            res.redirect("/admin/products");
        }

    } catch (error) {
        console.error("Error in editProduct:", error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            res.status(500).json({ 
                success: false, 
                message: "Error updating product",
                error: error.message 
            });
        } else {
            res.redirect("/pageerror");
        }
    }
};



const deleteSingleImage = async (req,res) => {
    try {
        const {imageNameToServer,productIdToServer} = req.body;
        const product = await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImage:imageNameToServer}});
        const imagePath = path.join("public","uploads","re-image",imageNameToServer);
        if(fs.existsSync(imagePath)){
            await fs.unlinkSync(imagePath);
            console.log(`Image ${imageNameToServer} deleted successfully`);
        }else{
            console.log(`Image ${imageNameToServer} not found`);
        }
        res.send({status:true})


    } catch (error) {
        res.redirect("/pageerror");
        
    }
    
}








module.exports={
    getProductAddPage,
    addProducts,
    getAllProducts,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage
}
