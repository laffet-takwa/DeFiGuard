import { chainName } from '../config';
import { shortAddress } from '../utils';

export default function WalletConnect({
  account,
  chainId,
  hasWallet,
  isConnected,
  onConnect,
  onDisconnect,
}) {
  if (!hasWallet) {
    return (
      <a
        className="btn btn-outline"
        href="https://metamask.io"
        target="_blank"
        rel="noreferrer"
      >
        Install Wallet
      </a>
    );
  }

  if (!isConnected) {
    return (
      <button className="btn btn-primary" onClick={onConnect}>
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="wallet-info">
      <span className="chain-badge" title={chainName(chainId)}>
        {chainName(chainId)}
      </span>
      <span className="account-badge" title={account}>
        {shortAddress(account)}
      </span>
      <button className="btn btn-ghost" onClick={onDisconnect}>
        Disconnect
      </button>
    </div>
  );
}
