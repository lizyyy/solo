import { RateRepository } from '../repositories/rate.repository';
import { ContractRepository } from '../repositories/contract.repository';
import { RateVersion, ProductContract } from '../../shared/types';

export class RateService {
  private rateRepository: RateRepository;
  private contractRepository: ContractRepository;

  constructor() {
    this.rateRepository = new RateRepository();
    this.contractRepository = new ContractRepository();
  }

  getAllRates(): RateVersion[] {
    return this.rateRepository.findAll();
  }

  getRatesByProduct(productId: string): RateVersion[] {
    return this.rateRepository.findByProductId(productId);
  }

  getRateById(id: string): RateVersion | null {
    return this.rateRepository.findById(id);
  }

  matchRateVersion(
    productId: string,
    chargeDate: string,
    contract: ProductContract | null
  ): { rate: RateVersion | null; contract: ProductContract | null; reasons: string[] } {
    const reasons: string[] = [];

    if (!contract) {
      reasons.push('未找到对应产品合同');
      return { rate: null, contract: null, reasons };
    }

    let applicableContract = contract;

    if (contract.expireDate && chargeDate > contract.expireDate) {
      reasons.push(`合同${contract.version}有效期至${contract.expireDate}，扣费日期${chargeDate}已过期`);

      const activeContract = this.contractRepository.findActiveContract(productId, chargeDate);
      if (activeContract) {
        applicableContract = activeContract;
        reasons.push(`已自动匹配续期合同${activeContract.version}（${activeContract.effectiveDate}起生效）`);
      } else {
        reasons.push('未找到有效的续期合同，适用老合同费率保护条款');
      }
    }

    const rateByContract = this.rateRepository.findByProductAndVersion(productId, applicableContract.version);
    if (rateByContract) {
      reasons.push(`合同版本${applicableContract.version}匹配费率版本${rateByContract.version}（${rateByContract.effectiveDate}起生效）`);
      return { rate: rateByContract, contract: applicableContract, reasons };
    }

    const activeRate = this.rateRepository.findActiveRate(productId, chargeDate);
    if (activeRate) {
      reasons.push(`按扣费日期${chargeDate}匹配费率版本${activeRate.version}（${activeRate.effectiveDate}起生效）`);

      if (applicableContract.baseRate !== activeRate.managementFeeRate + activeRate.serviceFeeRate) {
        reasons.push(`警告：合同基准费率${(applicableContract.baseRate * 100).toFixed(2)}%与费率版本总费率${((activeRate.managementFeeRate + activeRate.serviceFeeRate) * 100).toFixed(2)}%不一致，需核实合同费率保护条款`);
      }

      return { rate: activeRate, contract: applicableContract, reasons };
    }

    reasons.push(`未找到${chargeDate}有效的费率版本`);
    return { rate: null, contract: applicableContract, reasons };
  }

  getTotalRate(rate: RateVersion): number {
    return rate.managementFeeRate + rate.serviceFeeRate;
  }
}
