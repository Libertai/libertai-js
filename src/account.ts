import { ethers } from 'ethers';
import { GetAccountFromProvider, ETHAccount } from 'aleph-sdk-ts/dist/accounts/ethereum';

export class Account {
  //@ts-ignore
  private provider: ethers.providers.ExternalProvider;
  private account: ETHAccount | undefined;
  //@ts-ignore
  constructor(provider: ethers.providers.ExternalProvider) {
    this.provider = provider;
    this.account = undefined;
  }
  public async getAccount(): Promise<void> {
    this.account = await GetAccountFromProvider(this.provider);
  }
}
