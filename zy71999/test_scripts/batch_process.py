#!/usr/bin/env python3
import sys
import os
import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True)
    parser.add_argument("--output", default="result.csv")
    parser.add_argument("--fail", action="store_true")
    args = parser.parse_args()
    
    if args.fail:
        print(f"处理日期 {args.date} 时发生网络超时")
        sys.exit(1)
    
    output_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(output_dir, args.output)
    
    with open(output_path, 'w') as f:
        f.write(f"date,count\n")
        f.write(f"{args.date},100\n")
    
    print(f"处理完成: {output_path}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
