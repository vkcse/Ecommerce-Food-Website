const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const session = require("express-session");

mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "node_project"
});

const app = express();

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: false,
    cookie: { secure: false }
  }));

function isProductInCart(cart, id) {
    for(let i=0; i<cart.length; i++) {
        if (cart[i].id == id) {
            return true;
        }
    }
    return false;
}

function calculateTotal(cart, req) {
    let total = 0;
    for(let i=0; i<cart.length; i++) {
        if (cart[i].sale_price) {  //if we are offering some discount
            total = total + (cart[i].sale_price * cart[i].quantity);
        }else {
            total = total + (cart[i].price * cart[i].quantity);  //if we are not offering any discount
        }
    }
    req.session.total = total; // store this into session
    return total;
}

app.get("/", (req, res) => {

    var con = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "node_project"
    });

    con.query("SELECT * FROM PRODUCTS", (err, result) => {
        if (err) throw err;
        res.render("pages/index", {result: result});
    });
});

app.post("/action_to_cart", (req, res) => {

    const { id, name, price, sale_price, quantity, image } = req.body;
    const product = { id, name, price, sale_price, quantity, image };

    if (req.session.cart) {
        var cart = req.session.cart;

        if (!isProductInCart(cart, id)) {
            cart.push(product);
        }
    }else {
        req.session.cart = [product];
        var cart = req.session.cart;
    }
    // calculate total
    calculateTotal(cart, req);

    //return to cart page
    res.redirect("/cart");
    
});

app.get("/cart", (req, res) => {
    var cart = req.session.cart;
    var total = req.session.total;

    res.render('pages/cart', {cart: cart, total: total});
});

app.post('/remove_product',function(req,res){

    var id = req.body.id;
    var cart = req.session.cart;
 
    for(let i=0; i<cart.length; i++){
       if(cart[i].id == id){
          cart.splice(cart.indexOf(i),1);
       }
    }
 
    //re-calculate
    calculateTotal(cart,req);
    res.redirect('/cart');
 
 });

 app.post("/edit_product_quantity", (req, res) => {
    var id = req.body.id;
    var quantity = req.body.quantity;
    var increase_btn = req.body.increase_product_quantity;
    var decrease_btn = req.body.decrease_product_quantity;

    var cart = req.session.cart;

    if(increase_btn) {
        for (let i=0; i<cart.length; i++) {
            if (cart[i].id == id) {
                if(cart[i].quantity > 0) {
                    cart[i].quantity = parseInt(cart[i].quantity) + 1;
                }
            }
        }
    }

    if(decrease_btn) {
        for (let i=0; i<cart.length; i++) {
            if (cart[i].id == id) {
                if(cart[i].quantity > 0) {
                    cart[i].quantity = parseInt(cart[i].quantity) - 1;
                }
            }
        }
    }

    calculateTotal(cart, req);
    res.redirect('/cart');
 });

 app.get("/checkout", (req, res) => {
    var total = req.session.total;
    res.render("pages/checkout", {total: total});
 });

 app.post("/place_order", (req, res) => {
    var {name,email, phone, city, address} = req.body;
    var cost = req.session.total;
    var status = "Not paid";
    var date = new Date();
    var products_ids = "";
    var id = Date.now();
    req.session.order_id = id;

    var con = mysql.createConnection({   // insert into database
        host: "localhost",
        user: "root",
        password: "",
        database: "node_project"
    });

    var cart = req.session.cart;

    for(let i=0; i<cart.length; i++) {
        products_ids = products_ids + ", " + cart[i].id;
    }

    con.connect((err) => {
        if(err) {
            console.log(err);
        }else {
            var query = "INSERT INTO orders(id, name, cost, email, phone, city, address, date, status, products_ids) VALUES ?"
            var values = [
                [id, name, cost, email, phone, city, address, date, status, products_ids]
            ];

            con.query(query,[values],(err,result)=>{

                for(let i=0;i<cart.length;i++){
                   var query = "INSERT INTO order_items (order_id,product_id,product_name,product_price,product_image,product_quantity,order_date) VALUES ?";
                   var values = [
                      [id,cart[i].id,cart[i].name,cart[i].price,cart[i].image,cart[i].quantity,new Date()]
                   ];
                   con.query(query,[values],(err,result)=>{})
                }
    
                res.redirect('/payment')
            });
        }
    });
 });

 app.get("/payment", (req, res) => {
    const total = req. session.total;
    res.render("pages/payment", {total: total});
 });

app.get("/verify_payment", (req, res) => {
    const transaction_id = req.query.transaction_id;
    const order_id = req.session.order_id;

    var con = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "node_project"
    });

    con.connect((err) => {
        if(err) {
            console.log(err);
        }else {
            var query = "INSERT INTO payments (order_id, transaction_id, date) VALUES ?";
            var values = [
                [order_id, transaction_id, new Date()]
            ]
            con.query(query, [values], (err, result) => {
                con.query("UPDATE orders SET status='paid' WHERE ID='+order_id+'", (err, result) => {});
                res.redirect("/thank_you");
            });
        }
    });

});

app.get("/thank_you", (req, res) => {
    const order_id = req.session.order_id;

    res.render("pages/thank_you", {order_id: order_id});
});

app.get("/single_product", (req, res) => {
    var id = req.query.id;

    var con = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "node_project"
    });

    con.query("SELECT * FROM PRODUCTS WHERE id='"+id+"'", (err, result) => {
        res.render("pages/single_product", {result: result});
    });

});

app.get("/products", (req, res) => {
    var con = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "node_project"
    });

    con.query("SELECT * FROM PRODUCTS", (err, result) => {
        res.render("pages/products", {result: result});
    });
});

app.get("/about", (req, res) => {
    res.render('pages/about');
});

app.listen(8080, function(){
    console.log("Server is running on port 8080.");
});