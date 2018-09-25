import React from 'react';
import Header from '../components/header';

class ConversionPrompt extends React.Component {

  constructor(){
    super();
  }

  render(){
    return (
      <div className="small-card">
        <Header title="Convert to Dai" previousPage="/metamask-handler"/>
        <div className="hero">
          <div className="main-text">
            <h2>Once you begin your subscription, your Ethereum will be converted into Dai.</h2>
          </div>
          <div className="main-graphics">
            <img/>
            <img/>
            <img/>
          </div>
          <div className="secondary-text">
            <p>Why is this happening?</p>
            <p className="paragraph">DAI is a stablecoin that is pegged to the US Dollar, this means it’s value will always stay around $1.00ea. By converting your ETH to DAI, you will avoid the price fluctuations and will have enough funds to cover your subscription for 6 months.</p>
          </div>
        </div>
        <div className="button">
          <p>Convert to DAI</p>
        </div>
      </div>
    );
  }
};

export default ConversionPrompt;