export default function TestFaucet({ isLocalChain, onMint, busy, colSymbol, borSymbol }) {
  if (!isLocalChain) return null;

  return (
    <section className="card card-faucet">
      <div className="faucet-info">
        <h2>Test Faucet</h2>
        <p className="muted">
          Local network detected. Mint mock tokens to fund your wallet
          (owner-only, test deployments only).
        </p>
      </div>
      <button className="btn btn-outline" onClick={onMint} disabled={busy}>
        {busy ? 'Minting…' : `Mint 10 ${colSymbol} + 10,000 ${borSymbol}`}
      </button>
    </section>
  );
}
