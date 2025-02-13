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


// const addProducts = async(req,res)=>{
//     try {
//         const products = req.body;
//         const productExists = await Product.findOne({
//             productName:products.productName,
//         });

//         if(!productExists){
//             const images = [];

//             if(req.files && req.files.length>0){
//                 for(let i=0;i<req.files.length;i++){
//                     const OriginalImagesPath = req.files[i].path;

//                     const resizedImagePath = path.join('public','uploads','product-image',req.files[i].filename);
//                     await Sharp(OriginalImagesPath).resize({width:440,height:440}).toFile(resizedImagePath);
//                     images.push(req.files[i].filename);

//                 }
//             }

//             const categoryId = await Category.findOne({name:products.category});
//             if(!categoryId){
//                 return res.status(400).join("Invalid category name")
//             }

//             // Process size variants
//             const sizes = JSON.parse(products.sizes); // Expecting sizes as a JSON string from frontend
//             const formattedSizes = sizes.map(size => ({
//                 size: size.name, 
//                 price: size.price, 
//                 stock: size.stock 
//             }));

//             const newProduct = new Product({
//                 productName:products.productName,
//                 description:products.description,
//                 brand:products.brand,
//                 category:categoryId._id,
//                 regularPrice:products.regularPrice,
//                 salePrice:products.salePrice,
//                 sizes: formattedSizes,
//                 // createdOn:new Date(),
//                 quantity:products.quantity,
//                 size:products.size,
//                 color:products.color,
//                 productImage:images,
//                 status:'Available',

//             });

//             await newProduct.save();
//             return res.redirect("/admin/addProducts");
//         }else{
//             return res.status(400).json("Product already exist,please try with another name");
//         }



//     } catch (error) {
//         console.log("Error saving product",error);
//         return res.redirect("/admin/pageerror")
        
//     }
// }

const addProducts = async (req, res) => {
    try {
        const products = req.body;
        console.log("products", products);

        const productExists = await Product.findOne({ productName: products.productName });

        if (!productExists) {
            const images = [];

            // Handle image processing
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

            // Get category ID
            const categoryId = await Category.findOne({ name: products.category });
            if (!categoryId) {
                return res.status(400).json({ message: "Invalid category name" });
            }

            // Process sizes data
            let formattedSizes = [];
            if (products.sizes) {
                try {
                    const sizesData = JSON.parse(products.sizes);
                    formattedSizes = sizesData.map(sizeData => ({
                        size: sizeData.size,
                        quantity: parseInt(sizeData.quantity) // Changed from stock to quantity to match schema
                    }));
                } catch (error) {
                    console.error("Error parsing sizes:", error);
                    return res.status(400).json({ 
                        message: "Invalid sizes format",
                        error: error.message 
                    });
                }
            }

            // Create new product
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
            console.log|("newproducts nfjrnffnknr",newProduct)
            await newProduct.save();
            
            // Send success response
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
        
        // Send appropriate error response
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
        // Get the product with its category
        const product = await Product.findOne({ _id: id }).populate('category');
        
        // Get all categories to populate the dropdown
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isBlocked: false });

        if (!product || !categories || !brands) {
            return res.redirect("/pageerror");
        }

        res.render("admin/edit-product", {
            product: product,
            category: categories, // Changed from cat to category for clarity
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
        console.log("Product ID:", id);
        
        const product = await Product.findOne({ _id: id });
        const data = req.body;
        
        console.log("Received Category:", data.category);
        
        // Check for duplicate product name
        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        });

        if (existingProduct) {
            return res.status(400).json({ 
                error: "Product with this name already exists. Please try with another name" 
            });
        }

        // Handle new images if any were uploaded
        let updatedImages = [...product.productImage]; // Start with existing images
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => file.filename);
            updatedImages = [...updatedImages, ...newImages];
        }

        // Handle sizes
        let updatedSizes = [...product.sizes]; // Start with existing sizes
        if (data.sizes) {
            try {
                const newSizes = JSON.parse(data.sizes);
                // Create a map of existing sizes for easy lookup
                const existingSizeMap = new Map(
                    product.sizes.map(size => [size.size, size])
                );

                // Update quantities for existing sizes and add new ones
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

                // Remove sizes that are no longer selected
                updatedSizes = updatedSizes.filter(size => 
                    newSizes.some(newSize => newSize.size === size.size)
                );

            } catch (error) {
                console.error("Error parsing sizes:", error);
                return res.status(400).json({ message: "Invalid sizes format" });
            }
        }

        // Update fields
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
            // Update status based on total quantity
            status: updatedSizes.some(size => size.quantity > 0) ? 'Available' : 'out of stock'
        };

        // Update the product
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            updateFields,
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Handle response based on request type
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
