with open('src/components/RecordDetail.tsx', 'r') as f:
    content = f.read()

content = content.replace("type={!hasFeatureSnapshot ? '' : 'inner'}", "type={hasFeatureSnapshot ? 'inner' : undefined}")
content = content.replace("type={!hasThreshold ? '' : 'inner'}", "type={hasThreshold ? 'inner' : undefined}")

with open('src/components/RecordDetail.tsx', 'w') as f:
    f.write(content)
print('Done')
