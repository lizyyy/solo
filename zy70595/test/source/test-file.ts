// 正常导入语句
import { foo } from '@/foo';
import { bar } from '@components/Bar';
import { utils } from '@utils/index';
import { config } from '@test/config';
import relative from './relative';
import type { Type } from '@/types';

// 无效导入 - 缺少引号
import bad from @/missing-quotes;

// 无效导入 - 空路径
import empty from '';

// 无效导入 - 奇怪格式
import weird from `@/backticks`;