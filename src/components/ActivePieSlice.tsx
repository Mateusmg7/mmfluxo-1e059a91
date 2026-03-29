import { Sector } from 'recharts';

export const renderActiveSlice = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, ...rest } = props;

  return (
    <g>
      <Sector
        {...rest}
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))', transition: 'all 0.3s ease' }}
      />
    </g>
  );
};
