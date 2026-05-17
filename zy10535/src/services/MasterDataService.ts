import { Repository } from 'typeorm';
import { AppDataSource } from '../database/data-source';
import { Customer } from '../entities/Customer';
import { PersonInCharge } from '../entities/PersonInCharge';

export interface CreateCustomerDto {
  accountNumber: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  description?: string;
  createdBy?: string;
}

export interface CreatePersonInChargeDto {
  employeeId: string;
  name: string;
  department?: string;
  phone?: string;
  email?: string;
  createdBy?: string;
}

export class MasterDataService {
  private customerRepository: Repository<Customer>;
  private personRepository: Repository<PersonInCharge>;

  constructor() {
    this.customerRepository = AppDataSource.getRepository(Customer);
    this.personRepository = AppDataSource.getRepository(PersonInCharge);
  }

  async createCustomer(dto: CreateCustomerDto): Promise<Customer> {
    const existing = await this.customerRepository.findOne({
      where: { accountNumber: dto.accountNumber }
    });

    if (existing) {
      throw new Error(`客户账号 ${dto.accountNumber} 已存在`);
    }

    const customer = this.customerRepository.create({
      ...dto,
      isActive: true
    });

    return await this.customerRepository.save(customer);
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    return await this.customerRepository.findOne({ where: { id } });
  }

  async getCustomerByAccountNumber(accountNumber: string): Promise<Customer | null> {
    return await this.customerRepository.findOne({ where: { accountNumber } });
  }

  async getAllCustomers(includeInactive: boolean = false): Promise<Customer[]> {
    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }
    return await this.customerRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async updateCustomer(id: string, dto: Partial<CreateCustomerDto>): Promise<Customer> {
    const customer = await this.getCustomerById(id);
    if (!customer) {
      throw new Error('客户不存在');
    }

    if (dto.accountNumber && dto.accountNumber !== customer.accountNumber) {
      const existing = await this.getCustomerByAccountNumber(dto.accountNumber);
      if (existing) {
        throw new Error(`客户账号 ${dto.accountNumber} 已存在`);
      }
    }

    Object.assign(customer, dto);
    return await this.customerRepository.save(customer);
  }

  async deactivateCustomer(id: string): Promise<Customer> {
    const customer = await this.getCustomerById(id);
    if (!customer) {
      throw new Error('客户不存在');
    }

    customer.isActive = false;
    return await this.customerRepository.save(customer);
  }

  async createPersonInCharge(dto: CreatePersonInChargeDto): Promise<PersonInCharge> {
    const existing = await this.personRepository.findOne({
      where: { employeeId: dto.employeeId }
    });

    if (existing) {
      throw new Error(`员工号 ${dto.employeeId} 已存在`);
    }

    const person = this.personRepository.create({
      ...dto,
      isActive: true
    });

    return await this.personRepository.save(person);
  }

  async getPersonInChargeById(id: string): Promise<PersonInCharge | null> {
    return await this.personRepository.findOne({ where: { id } });
  }

  async getPersonInChargeByEmployeeId(employeeId: string): Promise<PersonInCharge | null> {
    return await this.personRepository.findOne({ where: { employeeId } });
  }

  async getAllPersonInCharge(includeInactive: boolean = false): Promise<PersonInCharge[]> {
    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }
    return await this.personRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async updatePersonInCharge(id: string, dto: Partial<CreatePersonInChargeDto>): Promise<PersonInCharge> {
    const person = await this.getPersonInChargeById(id);
    if (!person) {
      throw new Error('负责人不存在');
    }

    if (dto.employeeId && dto.employeeId !== person.employeeId) {
      const existing = await this.getPersonInChargeByEmployeeId(dto.employeeId);
      if (existing) {
        throw new Error(`员工号 ${dto.employeeId} 已存在`);
      }
    }

    Object.assign(person, dto);
    return await this.personRepository.save(person);
  }

  async deactivatePersonInCharge(id: string): Promise<PersonInCharge> {
    const person = await this.getPersonInChargeById(id);
    if (!person) {
      throw new Error('负责人不存在');
    }

    person.isActive = false;
    return await this.personRepository.save(person);
  }
}
