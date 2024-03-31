# Banyan KeyStore Js

props to Fission for the [original implementation](
  https://github.com/fission-codes/keystore-idb
)

## What 
In-browser key management with IndexedDB and the Web Crypto API.

Securely store and use keys for encryption, decryption, and signatures. IndexedDB and Web Crypto keep keys safe from malicious javascript.

Supports only Elliptic Curves (P-384) for Asymmetric for Encryption and Decryption, Signing and Verification.

Implements escrowing Assymetric keys with passphrases.

Symmetric Encryption and Decryption is supported with AES-GCM.

Symmetric Key Wrapping is supported with AES-KW.

## Install
Currently published under `banyan-webcrypto-experiment@1.0.2`

## Example Usage

```typescript
import * as Keystore from 'banyan-keystore-js/keystore/index'

async function run() {
  const ks = await Keystore.init()

  const msg = "Incididunt id ullamco et do."

  // TODO

  await Keystore.clear()
}

run()
```


## Development

```shell
# install dependencies
yarn

# run development server
yarn start

# build
yarn build

# test
# Note: use nodeV16 when running tests
# Note: unit tests are non-deterministic for some reason (prolly why it was all mocks to begin with)
yarn test

# test w/ reloading
yarn test:watch
```
# libertai-js
