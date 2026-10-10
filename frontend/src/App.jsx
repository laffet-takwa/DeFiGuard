import WalletConnect from './components/WalletConnect';
import PoolStats from './components/PoolStats';
import PositionCard from './components/PositionCard';
import ActionPanel from './components/ActionPanel';
import EventLog from './components/EventLog';
import TestFaucet from './components/TestFaucet';
import { useDeFiGuard } from './hooks/useDeFiGuard';
import { CONFIG, chainName } from './config';

export default function App() {
  const d = useDeFiGuard();

  const busy = d.tx.status === 'pending';

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="logo">DG</div>
          <div>
            <h1>DeFiGuard</h1>
            <p className="tagline">Lending Protocol Dashboard</p>
          </div>
        </div>
        <WalletConnect
          account={d.account}
          chainId={d.chainId}
          hasWallet={d.hasWallet}
          isConnected={d.isConnected}
          onConnect={d.connect}
          onDisconnect={d.disconnect}
        />
      </header>

      {!d.configured && (
        <div className="banner banner-error">
          <strong>Not configured.</strong> Copy <code>frontend/.env.example</code> to{' '}
          <code>frontend/.env</code> and set the deployed contract addresses
          (see README → Frontend).
        </div>
      )}

      {d.wrongNetwork && (
        <div className="banner banner-warning">
          Wrong network. Please switch to <strong>{chainName(CONFIG.expectedChainId)}</strong>{' '}
          (chain id {CONFIG.expectedChainId}) in your wallet.
        </div>
      )}

      {d.poolStats?.paused && (
        <div className="banner banner-warning">
          The pool is currently <strong>paused</strong>. All user-facing
          transactions will revert.
        </div>
      )}

      <div className="banner banner-info">
        Educational deployment: fixed exchange rate (no oracle), 0% interest,
        75% collateral factor, 80% liquidation threshold. Not audited — do not
        use with real funds.
      </div>

      {d.dataError && (
        <div className="banner banner-error">{d.dataError}</div>
      )}

      <main className="app-main">
        <div className="grid">
          <PoolStats
            poolStats={d.poolStats}
            tokens={d.tokens}
            poolAddress={CONFIG.lendingPoolAddress}
          />
          <PositionCard position={d.position} tokens={d.tokens} />
          <ActionPanel
            position={d.position}
            poolStats={d.poolStats}
            tokens={d.tokens}
            tx={d.tx}
            deposit={d.deposit}
            withdraw={d.withdraw}
            borrow={d.borrow}
            repay={d.repay}
            approve={d.approve}
            busy={busy}
          />
        </div>

        <TestFaucet
          isLocalChain={d.isLocalChain}
          onMint={d.mintTestTokens}
          busy={busy}
          colSymbol={d.tokens?.collateral?.symbol ?? 'WETH'}
          borSymbol={d.tokens?.borrow?.symbol ?? 'USDC'}
        />

        <EventLog events={d.events} tokens={d.tokens} />
      </main>

      <footer className="app-footer">
        <span>
          DeFiGuard · simplified lending protocol for educational purposes
        </span>
        {d.dataLoading && <span className="muted">refreshing…</span>}
      </footer>
    </div>
  );
}
