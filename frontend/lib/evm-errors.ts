function asErrorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isInsufficientFundsError(error: unknown) {
  const text = asErrorText(error);
  return /insufficient funds|funds for gas|exceeds balance|not enough balance|gas required exceeds allowance/i.test(
    text,
  );
}

export function isUnsupportedChainError(error: unknown) {
  const text = asErrorText(error);
  return /not configured in supportedNetworks|Chain eip155:\d+ is not configured|unsupported chain/i.test(
    text,
  );
}

export function normalizeEvmError(error: unknown) {
  const text = asErrorText(error);

  if (/User rejected|rejected the request|denied/i.test(text)) return "Transaction was rejected in your wallet.";
  if (isUnsupportedChainError(text)) {
    return "Wrong network selected. Switch your wallet to WireFluid and try again.";
  }
  if (isInsufficientFundsError(text)) {
    return "Insufficient WIRE balance for transaction + gas. Claim test tokens from the WireFluid faucet and retry.";
  }
  if (/Seat already reserved/i.test(text)) return "That seat is already reserved.";
  if (/Seat not for sale/i.test(text)) return "This seat is currently not for sale.";
  if (/Incorrect amount sent|Incorrect total amount/i.test(text)) return "Incorrect payment amount. Please refresh prices and try again.";
  if (/Invalid section|Row out of range|Seat number out of range/i.test(text)) return "Selected seat coordinates are invalid.";
  if (/Not the owner/i.test(text)) return "Only the owner of this ticket can mark it for resale.";
  if (/NEXT_PUBLIC_STATIC_MINT_METADATA_URI|metadata JSON|tokenURI/i.test(text)) {
    return "Mint blocked: your metadata URI is invalid. Set NEXT_PUBLIC_STATIC_MINT_METADATA_URI to a metadata JSON URL (ipfs://... or https://...) that includes an image field.";
  }
  return text;
}
