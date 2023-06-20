const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
app.use(cors());
app.use(express.json());
const stripe = require("stripe")(
  "sk_test_51NGwcgK1rPsA3dPJv7Q6l68B6d94IdTLsCNMEmYn6X3WiTcE8BaomRzVT1UgNq1IaejMwYf2j50nYljZBwYosOp000ylXdXmON"
);
require("dotenv").config();
const jwt = require("jsonwebtoken");

//middleware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: "Invalid token" });
    }
    req.decoded = decoded;
    next();
  });
};

app.get("/", (req, res) => {
  res.send("Boss is sitting");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri =
  "mongodb+srv://bistroDB:HxczuEGkoOKUCRGI@cluster0.pyqmcvy.mongodb.net/?retryWrites=true&w=majority;";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const menuCollection = client.db("bistroDB").collection("menuCallection");
    const reviewCollection = client
      .db("bistroDB")
      .collection("reviewCollection");
    const cartCollection = client.db("bistroDB").collection("cartCollection");
    const usersCollection = client.db("bistroDB").collection("usersCollection");
    const paymentCollection = client
      .db("bistroDB")
      .collection("paymentCollection");

    //jwt authorization
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(
        user,
        "0c6bf1f88db562e4084ee2d9f23dc71b694f0ac04c09411c54df8e03df2bd8bc86d664a0d3951dad8350fbbc41fa9ead0ff7df6aae433cba7edfab84ef9dc367",
        {
          expiresIn: "1h",
        }
      );
      res.send({ token });
    });

    //verify admin

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    //menu api
    app.get("/menu", async (req, res) => {
      const menu = await menuCollection.find({}).toArray();
      res.send(menu);
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const menu = await menuCollection.findOne({ _id: new ObjectId(id) });
      res.send(menu);
    });

    app.post("/menu", async (req, res) => {
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem);
      res.send(result);
    });

    //delete menu
    app.delete("/menu/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    //review app
    app.get("/reviews", async (req, res) => {
      const menu = await reviewCollection.find({}).toArray();
      res.send(menu);
    });

    // carts collection api
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "Access Denied." });
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const items = req.body;
      console.log(items);
      const result = await cartCollection.insertOne(items);
      res.send(result);
    });

    //cart delete
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    //user related api

    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //admin api
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //get admin

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        req.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    //payment api
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    // payment data save to database................................................................
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: { $in: payment.cartItems.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await cartCollection.deleteMany(query);

      res.send({ insertResult, deleteResult });
    });

    //admin stats
    app.get("/admin-stats", async (req, res) => {
      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce((sum, payment) => sum + payment.price, 0);
      const users = await usersCollection.estimatedDocumentCount();
      const products = await menuCollection.estimatedDocumentCount();
      const reviews = await reviewCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();
      res.send({ users, products, reviews, orders, revenue });
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
