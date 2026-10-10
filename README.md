## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
# DeFiGuard

A simplified decentralized finance (DeFi) lending protocol for educational purposes, built with Solidity, Foundry, and OpenZeppelin Contracts.

## Architecture

| Component | Path | Description |
| --- | --- | --- |
| `LendingPool.sol` | `src/` | Single-collateral / single-borrow lending pool. Deposit collateral, borrow against it (75% max LTV), repay, and withdraw while healthy (80% liquidation threshold). Health factor = `collateralValue × 0.80 / debt`. Fixed exchange rate (testing only), 0% interest. |
| `MockERC20.sol` | `src/` | Mintable/burnable ERC-20 with EIP-2612 permit support (test tokens only). |
| `Deploy.s.sol` | `script/` | Deploys WETH (18 dp), USDC (6 dp) and the pool; mints test tokens to the deployer. |
| `LendingPool.t.sol` | `test/` | Foundry unit tests. |
| **Frontend** | `frontend/` | React + Vite + ethers.js v6 dashboard (see below). |

## Smart contract usage

```shell
forge build          # compile
forge test -vvv      # run tests
forge fmt --check    # format check

# Local node + deploy
anvil
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

The deploy script prints the WETH, USDC and LendingPool addresses — copy them
into `frontend/.env` (see below).

## Frontend

A Web3 dashboard in `frontend/` (React 18 + Vite + ethers.js v6).

### Features

- Wallet connect / disconnect (MetaMask or any injected EIP-1193 wallet)
- Pool overview: total collateral, total debt, exchange rate, collateral
  factor, liquidation threshold, pause state
- Position dashboard: deposited collateral, collateral value, debt, max borrow,
  available borrow, and a color-coded **health factor gauge**
- Actions with guided ERC-20 approvals: **Deposit**, **Withdraw**, **Borrow**,
  **Repay** (partial + repay-all)
- Pre-flight checks that mirror the on-chain logic (insufficient balance,
  borrow-limit, and withdrawal-would-break-health warnings)
- Custom-error decoding for every revert path (e.g. `ExceedsBorrowLimit`,
  `PositionUndercollateralized`, `PoolPausedError`)
- Recent activity feed (Deposited / Withdrawn / Borrowed / Repaid / pool events)
- Test faucet (local networks only): mints mock WETH + USDC
- Wrong-network and paused-pool banners; auto-refresh every 15 s

### Setup

```shell
cd frontend
npm install
cp .env.example .env   # then fill in the deployed addresses
npm run dev            # http://localhost:5173
```

### Configuration (`frontend/.env`)

| Variable | Description |
| --- | --- |
| `VITE_LENDING_POOL_ADDRESS` | Deployed LendingPool address |
| `VITE_COLLATERAL_TOKEN_ADDRESS` | Collateral token (WETH mock) |
| `VITE_BORROW_TOKEN_ADDRESS` | Borrow token (USDC mock) |
| `VITE_CHAIN_ID` | Expected chain id (default `31337` = anvil) |

### Quick start (end-to-end on a local node)

```shell
# terminal 1: local chain
anvil

# terminal 2: deploy contracts
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# terminal 3: frontend
cd frontend
# set the three addresses from the deploy output in .env
npm run dev
```

Then open http://localhost:5173, connect the deployer account (it owns the
mock tokens), use the **Test Faucet** to fund the wallet, approve + deposit
WETH, and borrow USDC.

### Build

```shell
cd frontend
npm run build     # production bundle in frontend/dist
npm run preview   # preview the production build
```

> **Warning:** the protocol uses a fixed, owner-settable exchange rate and has
> not been audited. It is for education and local testing only — never use
> real funds.

