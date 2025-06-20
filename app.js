const path = require("path");

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const csrf = require("csurf");
const flash = require("connect-flash");
const multer = require("multer");
const errorController = require("./controllers/error");
const User = require("./models/user");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const csrfProtection = csrf();
const fs = require("fs");
require("dotenv").config();

const MONGODB_URI = process.env.URI_MONGODB;

const app = express();
const store = new MongoDBStore({
    uri: MONGODB_URI,
    collection: "sessions",
});

app.set("view engine", "ejs");
app.set("views", "views");

app.use(compression());
app.disable("x-powered-by");
app.use(helmet());
const accessLog = fs.createWriteStream(path.join(__dirname, "access.log"), {
    flags: "a",
});
morgan("combined", {stream: accessLog});
const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");

const fileFilters = (req, file, cb) => {
    if (
        file.mimetype === "image/png" ||
        file.mimetype === "image/jpg" ||
        file.mimetype === "image/jpeg"
    ) {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "images");
    },
    filename: (req, file, cb) => {
        cb(
            null,
            file.fieldname + "-" + Date.now() + path.extname(file.originalname)
        );
    },
});
app.use(bodyParser.urlencoded({extended: false}));
app.use(
    multer({storage: fileStorage, fileFilter: fileFilters}).single("image")
);
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use(
    session({
        secret: process.env.SECRET_SESSION,
        resave: false,
        saveUninitialized: false,
        store: store,
    })
);
app.use(csrfProtection);
app.use(flash());

app.use((req, res, next) => {
    if (!req.session.user) {
        return next();
    }
    User.findById(req.session.user._id)
        .then((user) => {
            if (!user) {
                return next();
            }
            req.user = user;
            next();
        })
        .catch((err) => {
            next(new Error(err));
        });
});

app.use((req, res, next) => {
    res.locals.isAuthenticated = req.session.isLoggedIn;
    res.locals.csrfToken = req.csrfToken();
    next();
});

app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.use("/500", errorController.get500);
app.use(errorController.get404);
app.use((error, req, res, next) => {
    // res.status(error,httpStatusCode).render()
    res.redirect("/500");
});
mongoose
    .connect(MONGODB_URI)
    .then((result) => {
        port = process.env.PORT || 9001;
        app.listen(port, () => {
            console.log(`listening to port server ${port}`);
        });
    })
    .catch((err) => {
        console.log(err);
    });
