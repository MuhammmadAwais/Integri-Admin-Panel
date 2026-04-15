import { useEffect, useState } from 'react';

// third-party
import ReactApexChart from 'react-apexcharts';

// project-imports
import MainCard from 'components/MainCard';

// chart-options
const earningChartOptions = {
  chart: {
    toolbar: {
      show: false
    }
  },
  dataLabels: {
    enabled: false
  },
  markers: {
    size: 6,
    hover: {
      size: 5
    }
  },
  stroke: {
    curve: 'straight',
    width: 6
  },

  grid: {
    xaxis: {
      lines: {
        show: false
      }
    },
    yaxis: {
      lines: {
        show: false
      }
    }
  },

  tooltip: {
    x: {
      show: false
    },

    marker: {
      show: false
    }
  },

  yaxis: {
    labels: {
      show: false
    }
  },

  xaxis: {
    categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    axisTicks: {
      show: false
    },
    axisBorder: {
      show: false
    }
  }
};

// =============================|| DEFAULT - EARNING CHART ||============================== //

export default function EarningChart() {
  const [series] = useState([{ name: 'Market Days ', data: [10, 60, 45, 72, 45, 86] }]);

  const [options, setOptions] = useState(earningChartOptions);

  useEffect(() => {
    // Dynamically get the chart line and text colors from CSS variables
    const rootStyle = getComputedStyle(document.documentElement);
    const lineColor = rootStyle.getPropertyValue('--chart-line').trim() || '#ffffff';
    const textColor = rootStyle.getPropertyValue('--chart-text').trim() || '#ffffff';

    setOptions({
      ...earningChartOptions,
      colors: [lineColor],
      xaxis: { 
        ...earningChartOptions.xaxis, 
        labels: { 
          style: { 
            colors: textColor,
            fontFamily: 'inherit'
          } 
        } 
      },
      markers: {
        ...earningChartOptions.markers,
        colors: [lineColor],
        strokeColors: lineColor
      },
      stroke: {
        ...earningChartOptions.stroke,
        colors: [lineColor]
      }
    });
  }, []);

  return (
    <MainCard
      title={<p className="mb-0" style={{ color: 'var(--chart-text)' }}>Earnings</p>}
      headerClassName="border-0"
      className="overflow-hidden"
      bodyClassName="py-0"
      style={{ background: 'var(--kpi-bg)', border: '2px solid var(--kpi-border)' }}
    >
      <div className="earning-text">
        <h3 className="mb-2 f-w-300" style={{ color: 'var(--chart-text)' }}>
          $4295.36 <i className="ph ph-arrow-up" />
        </h3>
        <span className="text-uppercase d-block" style={{ color: 'var(--chart-text)', opacity: 0.8 }}>Total Earnings</span>
      </div>
      <ReactApexChart options={options} series={series} type="line" height={210} />
    </MainCard>
  );
}
