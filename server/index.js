const express = require("express");
const cors = require("cors");
const app = express();

const bodyParser = require("body-parser");
app.use(cors());

app.use(bodyParser.json({limit: "30mb", extended: true}));
app.use(bodyParser.urlencoded({limit: "30mb", extended: true}));

const {
    Keys,
    RuntimeArgs,
    CLString,
    CLU512,
    decodeBase16,
    CLPublicKey,
    CasperClient,
    CasperServiceByJsonRPC,
    DeployUtil,
    EventStream,
    EventName,
    CLValueParsers,
    CLMap,
    CLValueBuilder
} = require("casper-js-sdk");


const RPC_API = "http://3.136.227.9:7777/rpc";
const client = new CasperServiceByJsonRPC("http://3.136.227.9:7777/rpc");

const contractHash = "hash-e3523602448b6085b861890b1c214181e2c1a7bdd2b23424b1941d1301256517";

const createUnlockDeploy = async (recipientPublicKey, amountUnlock, bscTxHash) => {
    const casperClient = new CasperClient(RPC_API);
    const signKeyPair = Keys.Ed25519.parseKeyFiles("account/public_key.pem", "account/secret_key.pem");

    const _contractHash = decodeBase16(
        "e3523602448b6085b861890b1c214181e2c1a7bdd2b23424b1941d1301256517"
    );

    const deployParams = new DeployUtil.DeployParams(signKeyPair.publicKey,
        "casper-test",
        1,
        1800000);

    let args = RuntimeArgs.fromMap({
        receipient_publickey: new CLString(recipientPublicKey),
        bsc_transaction_hash: new CLString(bscTxHash),

        amount: new CLU512((Math.pow(10, 9) * amountUnlock).toString()),
    });

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        _contractHash,
        "unlock_cspr",
        args
    );
    const deploy = await DeployUtil.makeDeploy(
        deployParams,
        session,
        DeployUtil.standardPayment(10000000000)
    );

    console.log('===== deploy ====')
    console.log(deploy);
    const signedDeploy = DeployUtil.signDeploy(deploy, signKeyPair);
    return await casperClient.putDeploy(signedDeploy);
};


const LOCKEventParser = (
    {
        contractHash,
        eventNames,
    },
    value
) => {
    if (value.body.DeployProcessed.execution_result.Success) {
        const {transforms} =
            value.body.DeployProcessed.execution_result.Success.effect;

        const {deploy_hash} = value.body.DeployProcessed;

        const LOCKEvents = transforms.reduce((acc, val) => {
            if (
                val.transform.hasOwnProperty("WriteCLValue") &&
                typeof val.transform.WriteCLValue.parsed === "object" &&
                val.transform.WriteCLValue.parsed !== null
            ) {
                const maybeCLValue = CLValueParsers.fromJSON(
                    val.transform.WriteCLValue
                );
                const clValue = maybeCLValue.unwrap();
                if (clValue && clValue instanceof CLMap) {
                    const hash = clValue.get(
                        CLValueBuilder.string("lock_unlock_cspr_contract")
                    );
                    const event = clValue.get(CLValueBuilder.string("event_type"));
                    if (
                        hash &&
                        // NOTE: Calling toLowerCase() because current JS-SDK doesn't support checksumed hashes and returns all lower case value
                        // Remove it after updating SDK
                        hash.value().slice(9) === contractHash.slice(5).toLowerCase() &&
                        event &&
                        eventNames.includes(event.value())
                    ) {
                        acc = [...acc, {name: event.value(), clValue}];
                        acc = [{deploy_hash}, ...acc,];
                    }
                }
            }

            return acc;
        }, []);

        return {error: null, success: !!LOCKEvents.length, data: LOCKEvents};
    }

    return null;
};
// sse catch start

const LOCKEvents = {
    LockCSPR: 'lock_cspr',
    UnLockCSPR: 'unlock_cspr',
}


const es = new EventStream("http://3.136.227.9:9999/events/main");

es.subscribe(EventName.DeployProcessed, (event) => {
        const parsedEvents = LOCKEventParser({
            contractHash,
            eventNames: [
                LOCKEvents.LockCSPR,
                LOCKEvents.UnLockCSPR

            ]
        }, event);

        if (parsedEvents && parsedEvents.success) {
            console.log("*** EVENT start***");
            console.log(JSON.stringify(parsedEvents.data));
            console.log("*** EVENT end***");
        }
    }
);

es.start();
// sse catch end

app.post("/", async (req, res) => {
    let {signedDeployJSON} = req.body;
    console.log('=============', signedDeployJSON);
    let signedDeploy = DeployUtil.deployFromJson(signedDeployJSON).unwrap();
    // new

    try {
        var {deploy_hash} = await client.deploy(signedDeploy);
        console.log("deploy_hash is: ", deploy_hash)
        res.status(200).send(deploy_hash);
    } catch (err) {
        console.log('=-=-=-=-=-=', err.message)
        res.status(406).send(err.message);
    }
});

app.listen(80, () => console.log("running on port 9000..."));
