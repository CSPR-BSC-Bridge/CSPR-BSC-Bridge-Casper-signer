const express = require("express");
const cors = require("cors");
const app = express();

const bodyParser = require("body-parser");
app.use(cors());

app.use(bodyParser.json({limit: "30mb", extended: true}));
app.use(bodyParser.urlencoded({limit: "30mb", extended: true}));

const {
    CLPublicKey,
    CasperClient,
} = require("casper-js-sdk");

const casperClient = new CasperClient("http://3.136.227.9:7777/rpc");

const test = async () => {
    const balance = await casperClient.balanceOfByPublicKey(CLPublicKey.fromHex("01ad9e598348205b9904930cb10fa99ccaa05bbc4499a20fd0a2d33ee679ac18f9"));
    console.log(balance.toString());
}

test()

