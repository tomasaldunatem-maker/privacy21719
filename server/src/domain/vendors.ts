export function vendorRisk(v: { sensitive: boolean; contractStatus: string; outsideChile: string }): 'ALTO' | 'MEDIO' | 'BAJO' {
  if (v.sensitive && v.contractStatus !== 'FIRMADO') return 'ALTO';
  if (v.contractStatus !== 'FIRMADO' || (v.sensitive && v.outsideChile !== 'NO')) return 'MEDIO';
  return 'BAJO';
}
