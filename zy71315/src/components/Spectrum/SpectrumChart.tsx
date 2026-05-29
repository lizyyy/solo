import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { SpectrumPoint, Peak, Experiment } from '../../types';
import { comparisonColors } from '../../utils/mockData';

interface SpectrumChartProps {
  experiments: Experiment[];
  showPeaks?: boolean;
  onPeakClick?: (peak: Peak, experimentId: string) => void;
  height?: number;
}

interface TooltipData {
  x: number;
  y: number;
  frequency: number;
  amplitude: number;
  experimentName: string;
  color: string;
}

export function SpectrumChart({
  experiments,
  showPeaks = true,
  onPeakClick,
  height = 300,
}: SpectrumChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [height]);

  const drawChart = useCallback(() => {
    if (!svgRef.current || experiments.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const width = dimensions.width - margin.left - margin.right;
    const chartHeight = dimensions.height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const allSpectrumData = experiments.flatMap((exp) => exp.spectrumData);
    const maxFrequency = Math.max(...allSpectrumData.map((d) => d.frequency));
    const maxAmplitude = Math.max(...allSpectrumData.map((d) => d.amplitude));
    const minAmplitude = Math.min(...allSpectrumData.map((d) => d.amplitude));

    const xScale = d3
      .scaleLinear()
      .domain([0, Math.min(maxFrequency, 2000)])
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain([minAmplitude - 5, maxAmplitude + 5])
      .range([chartHeight, 0]);

    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickSize(-chartHeight)
          .tickFormat(() => '')
      )
      .selectAll('.tick line')
      .attr('stroke', 'rgba(0, 245, 212, 0.1)');

    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-width)
          .tickFormat(() => '')
      )
      .selectAll('.tick line')
      .attr('stroke', 'rgba(0, 245, 212, 0.1)');

    g.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale).ticks(10))
      .selectAll('text')
      .attr('fill', '#B9BFC9')
      .attr('font-size', '10px');

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .selectAll('text')
      .attr('fill', '#B9BFC9')
      .attr('font-size', '10px');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -chartHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#B9BFC9')
      .attr('font-size', '11px')
      .text('幅度 (dB)');

    g.append('text')
      .attr('y', chartHeight + 35)
      .attr('x', width / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#B9BFC9')
      .attr('font-size', '11px')
      .text('频率 (Hz)');

    const line = d3
      .line<SpectrumPoint>()
      .x((d) => xScale(d.frequency))
      .y((d) => yScale(d.amplitude))
      .curve(d3.curveMonotoneX);

    experiments.forEach((experiment, index) => {
      const color = comparisonColors[index % comparisonColors.length];
      const gradientId = `gradient-${experiment.id}`;

      const gradient = svg
        .append('defs')
        .append('linearGradient')
        .attr('id', gradientId)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');

      gradient.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.8);
      gradient.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0.1);

      const area = d3
        .area<SpectrumPoint>()
        .x((d) => xScale(d.frequency))
        .y0(chartHeight)
        .y1((d) => yScale(d.amplitude))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(experiment.spectrumData.filter((d) => d.frequency <= 2000))
        .attr('fill', `url(#${gradientId})`)
        .attr('opacity', 0.3)
        .attr('d', area);

      g.append('path')
        .datum(experiment.spectrumData.filter((d) => d.frequency <= 2000))
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', experiments.length > 1 ? 1.5 : 2)
        .attr('d', line)
        .on('mousemove', (event) => {
          const [mouseX] = d3.pointer(event);
          const frequency = xScale.invert(mouseX - margin.left);
          
          const closestPoint = experiment.spectrumData.reduce((prev, curr) =>
            Math.abs(curr.frequency - frequency) < Math.abs(prev.frequency - frequency) ? curr : prev
          );

          setTooltip({
            x: event.clientX,
            y: event.clientY,
            frequency: closestPoint.frequency,
            amplitude: closestPoint.amplitude,
            experimentName: experiment.name,
            color,
          });
        })
        .on('mouseleave', () => setTooltip(null));

      if (showPeaks && experiment.peaks) {
        experiment.peaks.forEach((peak) => {
          if (peak.frequency > 2000) return;

          const peakColor = peak.isNoise ? '#EF4444' : color;
          const peakSize = peak.isNoise ? 4 : 6;

          g.append('circle')
            .attr('cx', xScale(peak.frequency))
            .attr('cy', yScale(peak.amplitude))
            .attr('r', peakSize)
            .attr('fill', peakColor)
            .attr('stroke', peak.isNoise ? '#EF4444' : '#ffffff')
            .attr('stroke-width', peak.status === 'confirmed' ? 2 : 1)
            .attr('stroke-dasharray', peak.isNoise ? '2,2' : 'none')
            .style('cursor', 'pointer')
            .style('opacity', peak.isNoise ? 0.6 : 1)
            .on('click', () => onPeakClick?.(peak, experiment.id))
            .on('mouseenter', function () {
              d3.select(this).attr('r', peakSize + 2);
            })
            .on('mouseleave', function () {
              d3.select(this).attr('r', peakSize);
            });

          if (!peak.isNoise) {
            g.append('text')
              .attr('x', xScale(peak.frequency))
              .attr('y', yScale(peak.amplitude) - 12)
              .attr('text-anchor', 'middle')
              .attr('fill', color)
              .attr('font-size', '9px')
              .attr('font-weight', 'bold')
              .text(`${peak.frequency.toFixed(0)} Hz`);
          }
        });
      }
    });

    if (experiments.length > 1) {
      const legend = g
        .append('g')
        .attr('transform', `translate(${width - 120}, 10)`);

      experiments.forEach((experiment, index) => {
        const color = comparisonColors[index % comparisonColors.length];
        const y = index * 20;

        legend
          .append('rect')
          .attr('x', 0)
          .attr('y', y)
          .attr('width', 12)
          .attr('height', 3)
          .attr('fill', color);

        legend
          .append('text')
          .attr('x', 20)
          .attr('y', y + 4)
          .attr('fill', '#B9BFC9')
          .attr('font-size', '10px')
          .text(experiment.name.substring(0, 15));
      });
    }
  }, [experiments, dimensions, showPeaks, onPeakClick]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  return (
    <div ref={containerRef} className="relative w-full spectrum-grid rounded-lg overflow-hidden">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="bg-dark-700/50"
      />
      
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none glass rounded-lg px-3 py-2 text-xs"
          style={{
            left: tooltip.x + 15,
            top: tooltip.y - 10,
          }}
        >
          <div className="font-medium" style={{ color: tooltip.color }}>
            {tooltip.experimentName}
          </div>
          <div className="text-dark-200 mt-1">
            <div>频率: {tooltip.frequency.toFixed(1)} Hz</div>
            <div>幅度: {tooltip.amplitude.toFixed(2)} dB</div>
          </div>
        </div>
      )}
    </div>
  );
}
