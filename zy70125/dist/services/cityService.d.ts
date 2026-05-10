import { CityNode, ServiceResult } from '../types';
export declare function createCity(name: string, code: string, description?: string): ServiceResult<CityNode>;
export declare function listCities(): ServiceResult<CityNode[]>;
export declare function getCityByIdentifier(identifier: string): ServiceResult<CityNode>;
export declare function deactivateCity(cityId: string): ServiceResult<CityNode>;
