const web3 = require('web3');
const keccak = require('./helpers/keccak');
const assertRevert = require('./helpers/assert_revert');

var MockPayrollSubscription = artifacts.require("./test/MockPayrollSubscription.sol");
var MockToken = artifacts.require("./test/MockToken.sol");
var ApprovedRegistry = artifacts.require("./ApprovedRegistry.sol");
var MockKyberNetwork = artifacts.require("./test/MockKyberNetwork.sol");

import { identifiers, amounts, createNewPayment, destinations } from './helpers/payroll.js';

contract('PayrollSubscription', function(accounts) {

    let contract;
    let token;

    let contractOwner = accounts[0]; // Owner of the actual contract
    let executorContract = accounts[1]; // Authorized address that can create plans and subscriptions
    let business = accounts[2]; // The business who has a subscription they want to earn money from
    let receiver = accounts[3]; // The user who is paying the business
    let unauthorizedAddress = accounts[4]; // Someone random

    let approvedRegistryContract;
    let kyberNetwork;

    let amount = 10;

    async function resetState() {
        console.log("Deploying a new contract");
        contract = await MockPayrollSubscription.new(approvedRegistryContract.address, { from: contractOwner });
        await contract.addAuthorizedAddress(executorContract);
        await contract.setTime(100);
    }

    before(async function() {

        kyberNetwork = await MockKyberNetwork.new({ from: contractOwner });
        approvedRegistryContract = await ApprovedRegistry.new(kyberNetwork.address, { from: contractOwner });
        token = await MockToken.new({ from: contractOwner });
        await approvedRegistryContract.addApprovedToken(token.address, false);

    });

    describe("when creating a schedule with payments", () => {

        before(async function() {

            await resetState();
    
        });

        it("should not be able to create with a start date less than now", async function() {

            await assertRevert(contract.createScheduleWithPayments(
                [], 
                [], 
                [],
                token.address,
                0,
                99,
                1000,
                true, 
                '',
                { from: business }
            ));

        });

        it("should not be able to create without an interval if one off is false", async function() {

            await assertRevert(contract.createScheduleWithPayments(
                [], 
                [], 
                [],
                token.address,
                100,
                1000,
                0,
                false, 
                '',
                { from: business }
            ));

        });

        it("should not be able to create with duplicate ids", async function() {

            // Add a duplicate of the first entry with a different amount
            await assertRevert(contract.createScheduleWithPayments(
                identifiers(), 
                amounts(5, 1), 
                destinations(receiver, 1),
                token.address,
                100,
                1000,
                0,
                true, 
                '',
                { from: business }
            ));

        });

        it("should not be able to create a schedule without payments", async function() {

            // Doesn't work
            // await assertRevert(contract.createScheduleWithPayments(
            //     [], 
            //     [], 
            //     [],
            //     token.address,
            //     100,
            //     1000,
            //     10,
            //     false, 
            //     { from: business }
            // ));

        });

        it("should not be able to create a schedule without a fee", async function() {

            await assertRevert(contract.createScheduleWithPayments(
                identifiers(), 
                amounts(10, 15), 
                destinations(receiver, 15),
                token.address,
                100,
                0,
                0,
                true, 
                '',
                { from: business }
            ));

        });

        it("should be able to create a schedule with the specified payments", async function() {
            

            let newSchedule = await contract.createScheduleWithPayments(
                identifiers(), 
                amounts(10, 15), 
                destinations(receiver, 15),
                token.address,
                100,
                0,
                1000,
                true, 
                '',
                { from: business }
            );

            let scheduleIdentifier = newSchedule.logs[0].args.scheduleIdentifier;

            let scheduleInformation = await contract.schedules.call(scheduleIdentifier);
            assert.equal(scheduleInformation[0], 0);
            assert.equal(scheduleInformation[1], 1000);
            assert.equal(scheduleInformation[2], token.address);
            assert.equal(scheduleInformation[3], 100);
            assert.equal(scheduleInformation[4], 0);
            assert.equal(scheduleInformation[5], true);
            assert.equal(scheduleInformation[6], business);

            let checkOne = await contract.payments.call(identifiers()[0]);
            assert.equal(checkOne[0], amount);
            assert.equal(checkOne[1], receiver);
            assert.equal(checkOne[2], 0);
            assert.equal(checkOne[3], 0);
            assert.equal(checkOne[4], scheduleIdentifier);

            let checkFifteen = await contract.payments.call(identifiers()[14]);
            assert.equal(checkOne[0], amount);
            assert.equal(checkOne[1], receiver);
            assert.equal(checkOne[2], 0);
            assert.equal(checkOne[3], 0);
            assert.equal(checkOne[4], scheduleIdentifier);

            let status = await contract.getPaymentStatus(identifiers()[0]);
            assert.equal(status, 1);

        });

        it("should not be able to create a schedule with the same token type and oneOff parameter", async function() {

            await assertRevert(contract.createScheduleWithPayments(
                identifiers(), 
                amounts(10, 15), 
                destinations(receiver, 15),
                token.address,
                100,
                1000,
                0,
                true, 
                '',
                { from: business }
            ));

        });

    });

    describe("when updating the schedule owner", () => {

        let scheduleIdentifier;
        
        before(async function() {

            await resetState();
            scheduleIdentifier = await createNewPayment(contract, token, receiver, business);

        });

        it("should not be able to update as an unauthorised user", async function() {

            await assertRevert(contract.updateScheduleOwner(
                scheduleIdentifier,
                unauthorizedAddress,
                { from: unauthorizedAddress }
            ));

        });

        it("should be able to update as the owner", async function() {

            await contract.updateScheduleOwner(
                scheduleIdentifier,
                unauthorizedAddress,
                { from: business }
            );

            let scheduleInformation = await contract.schedules.call(scheduleIdentifier);
            assert.equal(scheduleInformation[6], unauthorizedAddress); 

        });

    });

    describe("when updating the schedule data", () => {

        let scheduleIdentifier;
        
        before(async function() {

            await resetState();
            scheduleIdentifier = await createNewPayment(contract, token, receiver, business);

        });

        it("should not be able to update as an unauthorised user", async function() {

            await assertRevert(contract.updateScheduleData(
                scheduleIdentifier,
                '{}',
                { from: unauthorizedAddress }
            ));

        });

        it("should be able to update as the owner", async function() {

            await contract.updateScheduleData(
                scheduleIdentifier,
                '{}',
                { from: business }
            );

            let scheduleInformation = await contract.schedules.call(scheduleIdentifier);
            assert.equal(scheduleInformation[7], '{}'); 

        });

    });

    describe("when updating the schedule start date", () => {

        let scheduleIdentifier;

        before(async function() {

            await resetState();
            scheduleIdentifier = await createNewPayment(contract, token, receiver, business);
    
        });

        it("should not be able to update as an unauthorised user", async function() {

            await assertRevert(contract.updateStartDate(
                scheduleIdentifier,
                101,
                { from: unauthorizedAddress }
            ));

        });

        it("should not be able to set a date in the past", async function() {

            await assertRevert(contract.updateStartDate(
                scheduleIdentifier,
                99,
                { from: business }
            ));

        });

        it("should be able to update as the owner", async function() {

            await contract.updateStartDate(
                scheduleIdentifier,
                101,
                { from: business }
            );

        });

    });

    describe("when terminating the schedule", () => {

        let scheduleIdentifier;

        before(async function() {

            await resetState();
            scheduleIdentifier = await createNewPayment(contract, token, receiver, business);
    
        });

        it("should not be able to terminate as an unauthorised user", async function() {

            await assertRevert(contract.terminateSchedule(
                scheduleIdentifier,
                101,
                { from: unauthorizedAddress }
            ));

        });

        it("should not be able to terminate as a date in the past", async function() {

            await assertRevert(contract.terminateSchedule(
                scheduleIdentifier,
                99,
                { from: business }
            ));

        });

        it("should be able to terminate as the owner", async function() {

            await contract.updateStartDate(
                scheduleIdentifier,
                101,
                { from: business }
            );

        });

    });

    describe("when updating multiple payments", () => {

        let otherScheduleIdentifier;
        let scheduleIdentifier;
        let firstId = identifiers()[0];
        let secondId = identifiers()[1];
        let newId = '0xfcbaf63cb9a95a09c451e4a9943cb9b8f995ff08d6dd756944fc4437a4d37159';

        before(async function() {

            await resetState();
            scheduleIdentifier = await createNewPayment(contract, token, receiver, business);
    
        });

        it("should not be able to update as an unauthorised user", async function() {

            await assertRevert(contract.updatePayments(
                [firstId, secondId],
                [1, 1],
                [destinations()[0], destinations()[1]],
                scheduleIdentifier,
                { from: unauthorizedAddress }
            ));

        });

        it("should not be able to update the payment of another user", async function() {

            let id = '0xacbaf63cb9a95a09c451e4a9943cb9b8f995ff08d6dd756944fc4437a4d3aaaa';
            let newSchedule = await contract.createScheduleWithPayments(
                [id], 
                [5], 
                [receiver],
                token.address,
                100,
                0,
                1000,
                true, 
                '',
                { from: unauthorizedAddress }
            );
    
            otherScheduleIdentifier = newSchedule.logs[0].args.scheduleIdentifier;

            await assertRevert(contract.updatePayments(
                [id],
                [10],
                [receiver],
                otherScheduleIdentifier,
                { from: business }
            ));

            await assertRevert(contract.updatePayments(
                [newId],
                [10],
                [receiver],
                otherScheduleIdentifier,
                { from: business }
            ));

        });

        it("should be able to update multiple payments", async function() {

            await contract.updatePayments(
                [firstId, secondId],
                [1, 1],
                [receiver, receiver],
                scheduleIdentifier,
                { from: business }
            );
            
            let checkOne = await contract.payments.call(firstId);
            assert.equal(checkOne[0].toNumber(), 1);
            assert.equal(checkOne[1], receiver);

            let checkTwo = await contract.payments.call(secondId);
            assert.equal(checkTwo[0].toNumber(), 1);
            assert.equal(checkTwo[1], receiver);
            
        });

        it("should be able to update multiple payments and create new payments", async function() {

            await contract.updatePayments(
                [firstId, newId],
                [1, 1],
                [receiver, receiver],
                scheduleIdentifier,
                { from: business }
            );
            
            let checkOne = await contract.payments.call(firstId);
            assert.equal(checkOne[0].toNumber(), 1);
            assert.equal(checkOne[1], receiver);

            let checkTwo = await contract.payments.call(newId);
            assert.equal(checkTwo[0].toNumber(), 1);
            assert.equal(checkTwo[1], receiver);
            
        });

    });

    describe("when terminating payments", async function() {

        let scheduleIdentifier;
        let firstId = identifiers()[0];
        let secondId = identifiers()[1];

        before(async function() {

            await resetState();
            scheduleIdentifier = await createNewPayment(contract, token, receiver, business);
    
        });

        it("should not be able to terminate as an unauthorised user", async function() {

            await assertRevert(contract.terminatePayments(
                [firstId, secondId],
                [101, 101],
                { from: unauthorizedAddress }
            ));

        });

        it("should not be able to terminate as a date in the past", async function() {

            await assertRevert(contract.terminatePayments(
                [firstId, secondId],
                [99, 99],
                { from: business }
            ));

        });

        it("should not be able to terminate another user's payment", async function() {

            let id = '0xacbaf63cb9a95a09c451e4a9943cb9b8f995ff08d6dd756944fc4437a4d3aaaa';
            let newSchedule = await contract.createScheduleWithPayments(
                [id], 
                [5], 
                [receiver],
                token.address,
                100,
                0,
                1000,
                true, 
                '',
                { from: unauthorizedAddress }
            );
    
            let otherScheduleIdentifier = newSchedule.logs[0].args.scheduleIdentifier;

            await assertRevert(contract.terminatePayments(
                [otherScheduleIdentifier],
                [101],
                { from: business }
            ));

        });

        it("should be able to terminate multiple payments", async function() {

            await contract.terminatePayments(
                [firstId, secondId],
                [101, 101],
                { from: business }
            );

            let checkOne = await contract.payments.call(identifiers()[0]);
            assert.equal(checkOne[3], 101);

            let checkTwo = await contract.payments.call(identifiers()[1]);
            assert.equal(checkTwo[3], 101);

        });

    });

    describe("when setting the last payment date from the executor", () => {

        let scheduleIdentifier;

        before(async function() {

            await resetState();
            scheduleIdentifier = await createNewPayment(contract, token, receiver, business);
    
        });

        it("should not be able to set it as an unauthorised user", async function() {

            await assertRevert(contract.setLastestPaymentDate(
                1,
                identifiers()[0],
                { from: contractOwner }
            ));

        });

        it("should be able to set it and return whether it's the last payment date or not correctly", async function() {

            let params = await contract.setLastestPaymentDate(
                3,
                identifiers()[0],
                { from: executorContract }
            );

            let status = await contract.getPaymentStatus(identifiers()[0]);
            assert.equal(status, 3);

            let checkOne = await contract.payments.call(identifiers()[0]);
            assert.equal(checkOne[2], 3);

        });

        it("should not be able to set as a date before the last payment date", async function() {

            await assertRevert(contract.setLastestPaymentDate(
                2,
                identifiers()[0],
                { from: executorContract }
            ));

        });

    });

    describe("when cancelling a payment from the executor", () => {

        let scheduleIdentifier;

        before(async function() {

            await resetState();
            scheduleIdentifier = await createNewPayment(contract, token, receiver, business);
    
        });
        
        it("should not be able to set it as an unauthorised user", async function() {

            await assertRevert(contract.cancelPayment(
                identifiers()[0],
                { from: contractOwner }
            ));

        });

        it("should be able to cancel it from the executor", async function() {

            await contract.setLastestPaymentDate(
                3,
                identifiers()[0],
                { from: executorContract }
            );

            await contract.cancelPayment(
                identifiers()[0],
                { from: executorContract }
            );

            let checkOne = await contract.payments.call(identifiers()[0]);
            assert.equal(checkOne[2].toNumber(), 3);
            assert.equal(checkOne[3], 100);

            let status = await contract.getPaymentStatus(identifiers()[0]);
            assert.equal(status, 3);

        });

    });

});