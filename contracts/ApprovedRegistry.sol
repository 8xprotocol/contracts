pragma solidity 0.4.24;

import "./ApprovedRegistryInterface.sol";
import "./KyberNetworkInterface.sol";
import "./base/token/WETH.sol";

/** @title Approved contract, tokens and gas prices. */
/** @author Kerman Kohli - <kerman@8xprotocol.com> */

contract ApprovedRegistry is ApprovedRegistryInterface {

    struct GasCost {
        uint callValue;
        uint gasCost;
        uint gasPrice;
    }

    mapping (address => uint) public approvedTokenMapping; // Exchange rate cache (in case Kyber is down).
    mapping (address => mapping (uint => GasCost)) public approvedContractMapping;

    KyberNetworkInterface public kyberProxy;
    WETH public wrappedEther;

    address[] public approvedContractArray;
    address[] public approvedTokenArray;

    event ContractAdded(address indexed target);
    event ContractRemoved(address indexed target);

    event TokenAdded(address indexed target);
    event TokenRemoved(address indexed target);

    event ContractGasCostSet(address indexed contractAddress, uint indexed index);
    event ContractGasCostRemoved(address indexed contractAddress, uint indexed index);

    /**
      * MODIFIERS
    */

    modifier isValidSubscriptionContract(address _subscriptionContract) {
        require(approvedContractMapping[_subscriptionContract][0].callValue > 0);
        _;
    }

    modifier hasContractBeenApproved(address _contractAddress, bool _expectedResult) {
        require(isContractAuthorised(_contractAddress) == _expectedResult);
        _;
    }

    modifier hasTokenBeenApproved(address _tokenAddress, bool _expectedResult) {
        require(isTokenAuthorised(_tokenAddress) == _expectedResult);
        _;
    }

    /**
      * PUBLIC FUNCTIONS
    */

    /** @dev Set the addresses for the relevant contracts
      * @param _kyberAddress the address for the kyber network contract.
    */
    constructor(address _kyberAddress) public {
        // @TODO: Figure out how to add tests for this
        kyberProxy = KyberNetworkInterface(_kyberAddress);
    }

    /** @dev Get the gas costs for executing a transaction in a particular currency.
      * @param _tokenAddress is the address of the token.
      * @param _contractAddress is the address of the contract.
      * @param _index for the calling contract function.
    */
    function getGasCost(
        address _tokenAddress,
        address _contractAddress,
        uint _index
    )
        public returns (uint)
    {
        uint currentRate = getRateFor(_tokenAddress); // in wei
        uint gasCost = approvedContractMapping[_contractAddress][_index].gasCost;
        uint standardGasPrice = approvedContractMapping[_contractAddress][_index].gasPrice;
        uint standardCost = ((gasCost * standardGasPrice) / (10**18) / currentRate);

        // X = gas required * price of ETH/USD
        // X = (one ether / gas required) * price of USD/ETH
        // X = (300,000) / ((10**18) / (2*10**15)

        return standardCost;

    }

    /** @dev Get exchange rate for token.
      * @param _tokenAddress is the address for the token.
    */
    function getRateFor(address _tokenAddress) public returns (uint) {
        (, uint rate) = kyberProxy.getExpectedRate(
            ERC20(_tokenAddress),
            ERC20(0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee),
            10**18
        );

        if (rate > 0) {
            approvedTokenMapping[_tokenAddress] = rate;
            return rate;
        }

        // Gas spike hence return cached value
        return approvedTokenMapping[_tokenAddress] = rate;
    }

    /** @dev Add an approved subscription contract to be used.
      * @param _contractAddress is the address of the subscription contract.
    */
    function addApprovedContract(address _contractAddress)
        public
        onlyOwner
        hasContractBeenApproved(_contractAddress, false)
    {
        approvedContractArray.push(_contractAddress);
        emit ContractAdded(_contractAddress);
    }

    /** @dev Set an approved contract call cost.
      * @param _contractAddress is the address of the subscription contract.
      * @param _index is the reference to the call (cancel, subscribe etc).
      * @param _callValue is how much the transaction will cost.
      * @param _gasCost is the amount of gas that will be used.
      * @param _gasPrice is the gas price that will be reimbursed up to.
    */
    function setApprovedContractCallCost(
        address _contractAddress,
        uint _index,
        uint _callValue,
        uint _gasCost,
        uint _gasPrice
    )
        public
        onlyOwner
        hasContractBeenApproved(_contractAddress, true)
    {
        approvedContractMapping[_contractAddress][_index] = GasCost({
            callValue: _callValue,
            gasCost: _gasCost,
            gasPrice: _gasPrice
        });

        emit ContractGasCostSet(_contractAddress, _index);

    }

    /** @dev Add an approved token to be used.
      * @param _tokenAddress is the address of the token to be used.
    */
    function addApprovedToken(address _tokenAddress, bool _isWETH)
        public
        onlyOwner
        hasTokenBeenApproved(_tokenAddress, false)
    {
        approvedTokenArray.push(_tokenAddress);

        if (_isWETH == true && address(wrappedEther) == 0) {
            // @TODO: Write tests for this
            wrappedEther = WETH(_tokenAddress);
        }

        emit TokenAdded(_tokenAddress);
    }

    /** @dev Remove an approved subscription contract.
      * @param _contractAddress is the address of the subscription contract.
    */
    function removeApprovedContract(address _contractAddress)
        public
        onlyOwner
    {
        for (uint i = 0; i < approvedContractArray.length; i++) {
            if (approvedContractArray[i] == _contractAddress) {
                approvedContractArray[i] = approvedContractArray[approvedContractArray.length - 1];
                approvedContractArray.length--;

                emit ContractRemoved(_contractAddress);

                break;
            }
        }
    }

    /** @dev Remove an approved contract call cost.
      * @param _contractAddress is the address of the contract.
      * @param _index is the reference to the call (cancel, subscribe etc).
    */
    function removeApprovedContractCallCost(
        address _contractAddress,
        uint _index
    )
        public
        onlyOwner
    {
        delete approvedContractMapping[_contractAddress][_index];

        emit ContractGasCostRemoved(_contractAddress, _index);
    }

    /** @dev Remove an approved token to be used.
      * @param _tokenAddress is the address of the token to remove.
    */
    function removeApprovedToken(address _tokenAddress)
        public
        onlyOwner
    {
        for (uint i = 0; i < approvedTokenArray.length; i++) {
            if (approvedTokenArray[i] == _tokenAddress) {
                approvedTokenArray[i] = approvedTokenArray[approvedTokenArray.length - 1];
                approvedTokenArray.length--;

                delete approvedTokenMapping[_tokenAddress];

                emit TokenRemoved(_tokenAddress);

                break;
            }
        }

        if (_tokenAddress == address(wrappedEther)) {
            // @TODO: Write tests for this
            delete wrappedEther;
        }
    }

    /** @dev Get approved contract array.
    */
    function getApprovedContracts()
        public
        constant
        returns (address[])
    {
        return approvedContractArray;
    }

    /** @dev Get approved token array.
    */
    function getApprovedTokens()
        public
        constant
        returns (address[])
    {
        return approvedTokenArray;
    }

    /** @dev Check if a subscription has been authorised.
      * @param _contractAddress is the address of the contract.
    */
    function isContractAuthorised(address _contractAddress) public returns (bool) {
        require(_contractAddress != 0);

        bool contractFoundInRegistry = false;

        for (uint i = 0; i < approvedContractArray.length; i++) {
            if (approvedContractArray[i] == _contractAddress) {
                contractFoundInRegistry = true;
                break;
            }
        }

        return contractFoundInRegistry;
    }

    /** @dev Check if a token has been authorised.
      * @param _tokenAddress is the address of the token.
    */
    function isTokenAuthorised(address _tokenAddress) public returns (bool) {
        require(_tokenAddress != 0);

        bool tokenFoundInRegistry = false;

        for (uint i = 0; i < approvedTokenArray.length; i++) {
            if (approvedTokenArray[i] == _tokenAddress) {
                tokenFoundInRegistry = true;
                break;
            }
        }

        return tokenFoundInRegistry;
    }


}