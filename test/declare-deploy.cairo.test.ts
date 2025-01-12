import { BigNumber } from "ethers";
import { expect } from "chai";
import { starknet } from "hardhat";
import { TIMEOUT } from "./constants";
import { ensureEnvVar } from "./util";
import { StarknetContract, StarknetContractFactory, Account } from "hardhat/types/runtime";
import { shortString, uint256, number } from "starknet";

// const init_balance = "1000000000000000000";
const init_balance = 1000000000000000000n;
let bridge = BigNumber.from("0xb5029935A185A8Fec57B178543481F48Cb6665C6");

describe("Class declaration", function () {
  this.timeout(TIMEOUT);
  let account: Account;

  it("should declare and deploy a class", async function () {
    const response = await starknet.devnet.getPredeployedAccounts();
    account = await starknet.getAccountFromAddress(response[0].address, response[0].private_key, "OpenZeppelin");

    // Possibly use a real account when you can
    // account = await starknet.getAccountFromAddress(
    //   ensureEnvVar("DEVNET_OZ_ACCOUNT_ADDRESS"),
    //   ensureEnvVar("DEVNET_OZ_ACCOUNT_PRIVATE_KEY"),
    //   "OpenZeppelin",
    // );
    // account = await starknet.getAccountFromAddress(
    //   ensureEnvVar("OZ_ACCOUNT_ADDRESS"),
    //   ensureEnvVar("OZ_ACCOUNT_PRIVATE_KEY"),
    //   "OpenZeppelin",
    // );
    // let deployAccountOptions = {
    //   privateKey: ensureEnvVar("OZ_ACCOUNT_PRIVATE_KEY"),
    // };
    // account = await starknet.deployAccount("OpenZeppelin", deployAccountOptions);

    let ERC20ContractFactory = await starknet.getContractFactory("ERC20_mintable");
    const classHash = await ERC20ContractFactory.declare();
    console.log("ClassHash", classHash);

    const deployerFactory = await starknet.getContractFactory("deployer");
    const deployer = await deployerFactory.deploy(
      {
        class_hash: classHash,
        bridge: bridge,
      },
      { salt: "0x42" },
    );

    console.log("Deployer Address", deployer.address);

    const constructorArgs = {
      name: shortString.encodeShortString("TEST"),
      symbol: shortString.encodeShortString("TST"),
      decimals: 18,
      // initial_supply: uint256.bnToUint256(init_balance),
      // testing init with low level felts insted of struct
      initial_supply: { low: init_balance, high: 0 },
      recipient: account.address,
    };

    const estimatedFee = await account.estimateFee(deployer, "deploy_contract", constructorArgs);
    console.log("Estimated fee", estimatedFee);
    const deploymentHash = await account.invoke(deployer, "deploy_contract", constructorArgs, {
      maxFee: estimatedFee.amount * 2n,
    });

    const receipt = await starknet.getTransactionReceipt(deploymentHash);
    // console.log("Receipt", receipt);
    // console.log(receipt.events[0]);
    // console.log(receipt.events[1]);
    // console.log(receipt.events[2]);
    const deploymentEvent = receipt.events[2];
    const deploymentAddress = deploymentEvent.data[0];
    console.log("ERC20 Deployment address", deploymentAddress);

    const contract = ERC20ContractFactory.getContractAt(deploymentAddress);
    const res = await contract.call("totalSupply");
    console.log(res);

    let accountBalance = await contract.call("balanceOf", { account: account.address });
    console.log(accountBalance);

    // expect(res.totalSupply.low).to.deep.equal(init_balance);
  });
});
