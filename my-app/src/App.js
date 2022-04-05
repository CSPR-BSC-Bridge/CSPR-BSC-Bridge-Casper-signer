import React, { useState,useEffect } from "react";
import { fetchDetail } from "./api";

import {
  Signer,
  DeployUtil,
  CLPublicKey,
  decodeBase16,
  RuntimeArgs,
  CLString,
  CLU512,

} from "casper-js-sdk";


function App() {
  const [signerConnected, setSignerConnected] = useState(false);

  const [activeKey, setActiveKey] = useState("");

  const [receipient_publickey, setReceipient_publickey] = useState("")
  const [amountUnlock, setAmountUnlock] = useState("")
  const [amountLock, setAmountLock] = useState("")
  const [bsc_transaction_hash, setBsc_transaction_hash] = useState("")
  const [bsc_recipient_address,setBsc_recipient_address] = useState("")
  const [deployhashLock, setDeployhashLock] = useState("");
  const [deployhashUnlock, setDeployhashUnlock] = useState("");

  const checkConnection = async () => {
    return await Signer.isConnected();
  };

  const getActiveKeyFromSigner = async () => {
    return await Signer.getActivePublicKey();
  };

  const connectToSigner = async () => {
    return Signer.sendConnectionRequest();
  };

  const createUnlockDeploy = async (publicKeyHex) => {
    const publicKey = CLPublicKey.fromHex(publicKeyHex);
    // contract hash
    const contractHash = decodeBase16(
      "152935c4378bbb59f4f9048a281d41306571f2f5fedc61f4b19aa00c0793418d"
    );
    const deployParams = new DeployUtil.DeployParams(publicKey,
      "casper-test",
      1,
      1800000);

    let args = RuntimeArgs.fromMap({
      receipient_publickey: new CLString(receipient_publickey),
      bsc_transaction_hash: new CLString(bsc_transaction_hash),
      
      amount: new CLU512(amountUnlock),
    });

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      contractHash,
      "unlock_cspr",
      args
    );

    return DeployUtil.makeDeploy(
      deployParams,
      session,
      DeployUtil.standardPayment(10000000000)
    );
  };

  const createLockDeploy = async (publicKeyHex) => {
    const publicKey = CLPublicKey.fromHex(publicKeyHex);

    const deployParams = new DeployUtil.DeployParams(publicKey,
      "casper-test",
      1,
      1800000);
    let args = [];

    args = RuntimeArgs.fromMap({
      bsc_recipient_address: new CLString(bsc_recipient_address),
      amount: new CLU512(amountLock),
      //  main contract hash
      contract_hash_str: new CLString("contract-152935c4378bbb59f4f9048a281d41306571f2f5fedc61f4b19aa00c0793418d")
    });
    
    const response = await fetch('lock_cspr.wasm')
    const bytes = await response.arrayBuffer()
    const lock_cspr_moduleBytes = new Uint8Array(bytes)

    
    const session = DeployUtil.ExecutableDeployItem.newModuleBytes(
      lock_cspr_moduleBytes,
      args
    );

    return DeployUtil.makeDeploy(
      deployParams,
      session,
      DeployUtil.standardPayment(10000000000)
    );
  };

  const signDeployUnlock = async () => { 
    // check inputs are ready
    if (!bsc_transaction_hash || !amountUnlock || !receipient_publickey) { 
      console.log("please input 3 arguments")
      return
    }

    if (!activeKey) { 
      return
    }
    // 
    // check publickey format
    var regex1 = /^[0][1]/;
    var regex2 = /^[0][2]/;
    if (!(receipient_publickey.length == 66 && regex1.test(receipient_publickey)) &&
      !(receipient_publickey.length == 68 && regex2.test(receipient_publickey))) {
      console.log("publickey format incorrect")
      return
    }
    //
    let key;
    try {
      key = await Signer.getActivePublicKey();
    } catch (err) {
      console.log(err)
      return;
    }

    setActiveKey(key);
    let deploy, deployJSON;

    deploy = await createUnlockDeploy(key);
        deployJSON = DeployUtil.deployToJson(deploy);
    let signedDeployJSON; 
    
    try {
      signedDeployJSON = await Signer.sign(deployJSON, key, key);
    } catch (err) {
      console.log(err)
      return;
    }
  
    const { data } = await fetchDetail(signedDeployJSON);
    console.log("data:",data)

    setDeployhashUnlock(data);

  }

  const signDeployLock = async () => { 
    // check inputs are ready
    if (!bsc_recipient_address || !amountLock) { 
      console.log("please input 2 arguments")
      return
    }
    if (!activeKey) { 
      return
    }
    // 
    // check bsc_recipient_address format
    // 
    //
    let key;
    try {
      key = await Signer.getActivePublicKey();
    } catch (err) {
      console.log(err)
      return;
    }

    setActiveKey(key);
    let deploy, deployJSON;

    deploy = await createLockDeploy(key);
        deployJSON = DeployUtil.deployToJson(deploy);
    let signedDeployJSON; 
    
    try {
      signedDeployJSON = await Signer.sign(deployJSON, key, key);
    } catch (err) {
      console.log(err)
      return;
    }
  
    const { data } = await fetchDetail(signedDeployJSON);
    console.log("data:",data)

    setDeployhashLock(data);

  }

  useEffect(() => {
    // Your code here
    setTimeout(async () => {
      try {
        const connected = await checkConnection();
        setSignerConnected(connected);
      } catch (err) {
        console.log(err)
      }
    }, 100);

    const tmpfunc = async () => {
      if (signerConnected) setActiveKey(await getActiveKeyFromSigner());
    };
    tmpfunc();

    window.addEventListener("signer:connected", (msg) => {
 
      setSignerConnected(true);
      setActiveKey(msg.detail.activeKey);
      
 
    });
    window.addEventListener("signer:disconnected", (msg) => {
    
      setSignerConnected(false);
      setActiveKey(msg.detail.activeKey);
   

    });
    window.addEventListener("signer:tabUpdated", (msg) => {

      setSignerConnected(msg.detail.isConnected);
      setActiveKey(msg.detail.activeKey);
    });
    window.addEventListener("signer:activeKeyChanged", (msg) => {
      setActiveKey(msg.detail.activeKey);
    
 
    });
    window.addEventListener("signer:locked", (msg) => {

      setActiveKey(msg.detail.activeKey);
    });
    window.addEventListener("signer:unlocked", (msg) => {

      setSignerConnected(msg.detail.isConnected);
      setActiveKey(msg.detail.activeKey);
    });
    window.addEventListener("signer:initialState", (msg) => {
      console.log("Initial State: ", msg.detail);
 
      setSignerConnected(msg.detail.isConnected);
      setActiveKey(msg.detail.activeKe);
    });
  }, []);


  return (
    <div className="App">
      <div>
        <button onClick={connectToSigner}> connect to mysigner</button>
        <div>Public key</div>
        <div> {activeKey}</div>
      </div>
      <hr />
      <div>======<strong>UNLOCK CSPR</strong> ======
      <div>
        <label htmlFor="">receipient_publickey 
          <input type="text" value={receipient_publickey}
            onChange={e => setReceipient_publickey(e.target.value)} />
          { receipient_publickey}
          </label>
        
          <br />
        
        <label htmlFor="">bsc_transaction_hash 
          <input type="text" value={bsc_transaction_hash}
            onChange={ e=>setBsc_transaction_hash(e.target.value)}/>
          { bsc_transaction_hash}  
        </label>
          
          <br />
          <label htmlFor="">amount 
          <input type="number" value={amountUnlock}
            onChange={e => setAmountUnlock(e.target.value)} />
          { amountUnlock}
          </label>
          <br />
        <div><input type="submit" value="deploy" onClick={signDeployUnlock} />
          <hr />
        </div>

        { deployhashUnlock && <div>unlock deploy hash { deployhashUnlock}</div>}

        </div>
      </div>
      <hr />
      <div>======<strong>LOCK CSPR</strong> ======
      <div>
          {/* //     --session-arg "amount:U512='100'" \
// --session-arg "bsc_recipient_address:String='123456789'" \ */}
          
        <label htmlFor="">bsc_recipient_address 
          <input type="text" value={bsc_recipient_address}
            onChange={ e=>setBsc_recipient_address(e.target.value)}/>
          { bsc_recipient_address}  
        </label>
          
          <br />
          <label htmlFor="">amount 
          <input type="number" value={amountLock}
            onChange={e => setAmountLock(e.target.value)} />
          { amountLock}
          </label>
          <br />
        <div><input type="submit" value="deploy" onClick={signDeployLock} />
          <hr />
        </div>

        { deployhashLock && <div>lock deploy hash { deployhashLock}</div>}

        </div>
        </div>
    </div>
  );
}

export default App;
