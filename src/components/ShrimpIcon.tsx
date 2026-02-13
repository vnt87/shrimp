import { FC } from 'react'

interface ShrimpIconProps {
    className?: string
    size?: number | string
    strokeWidth?: number | string
    color?: string
}

const ShrimpIcon: FC<ShrimpIconProps> = ({
    className,
    size = 24,
    strokeWidth = 2,
    color = "currentColor"
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 22 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <path
            d="M10 9.00008V13.0001M10 9.00008H13C17.418 9.00008 21 6.41809 21 2.00008V1.00008H10M10 9.00008H1.55M10 9.00008L4.055 3.05908M10 9.00008L4.059 14.9451M10 13.0001V1.00008M10 13.0001H13C13.7956 13.0001 14.5587 13.3162 15.1213 13.8788C15.6839 14.4414 16 15.2044 16 16.0001V17.0001H9C7.1239 16.9978 5.30783 16.3386 3.867 15.1371C2.96612 14.3889 2.24189 13.4507 1.74623 12.3897C1.25057 11.3287 0.995737 10.1711 1 9.00008C1.00201 7.83103 1.25925 6.67652 1.75376 5.6172C2.24827 4.55789 2.96811 3.61932 3.863 2.86708C5.29865 1.65335 7.12007 0.991372 9 1.00008H10M10 13.0001V17.0001M15.002 3.99809H14.998V4.00208H15.002V3.99809Z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="square"
        />
    </svg>
)

export default ShrimpIcon
