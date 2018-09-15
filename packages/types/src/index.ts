import { BigNumber } from "bignumber.js";

import * as _ from "lodash";

export interface TxData {
    from?: string;
    gas?: BigNumber;
    gasPrice?: BigNumber;
    nonce?: BigNumber;
}

export interface TxDataPayable extends TxData {
    value?: BigNumber;
}

export interface MultiSigSubmissionEventArgs {
    transactionId: BigNumber;
}

export const classUtils = {
    // This is useful for classes that have nested methods. Nested methods don't get bound out of the box.
    bindAll(self: any, exclude: string[] = ["contructor"], thisArg?: any): void {
        for (const key of Object.getOwnPropertyNames(self)) {
            const val = self[key];
            if (!_.includes(exclude, key)) {
                if (_.isFunction(val)) {
                    self[key] = val.bind(thisArg || self);
                } else if (_.isObject(val)) {
                    classUtils.bindAll(val, exclude, self);
                }
            }
        }
        return self;
    },
};

export interface Log {
    event: string;
    args: object;
}

export type Address = string;
export type UInt = BigNumber;
export type Bytes32 = string;

export enum SolidityType {
    address = "address",
    uint256 = "uint256",
    uint8 = "uint8",
    uint = "uint",
    bytes32 = "bytes32",
    boolean = "bool",
    string = "string",
}

export interface AddressBook {
    actionProxyAddress?: string;
    approvedRegistryAddress?: string;
    executorAddress?: string;
    paymentRegistryAddress?: string;
    requirementsAddress?: string;
    stakeContractAddress?: string;
    transferProxyAddress?: string;
    volumeSubscriptionAddress?: string;
    daiAddress?: string;
  }
