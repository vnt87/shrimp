
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { loadFull } from "tsparticles";

import type { ISourceOptions } from "@tsparticles/engine";
import Particles, { initParticlesEngine } from "@tsparticles/react";

const options: ISourceOptions = {
    key: "star",
    name: "Star",
    particles: {
        number: {
            value: 20,
            density: {
                enable: false,
            },
        },
        color: {
            value: ["#7c3aed", "#bae6fd", "#a78bfa", "#93c5fd", "#0284c7", "#fafafa", "#38bdf8"],
        },
        shape: {
            type: "star",
            options: {
                star: {
                    sides: 4,
                },
            },
        },
        opacity: {
            value: 0.8,
        },
        size: {
            value: { min: 1, max: 4 },
        },
        rotate: {
            value: {
                min: 0,
                max: 360,
            },
            enable: true,
            direction: "clockwise",
            animation: {
                enable: true,
                speed: 10,
                sync: false,
            },
        },
        links: {
            enable: false,
        },
        reduceDuplicates: true,
        move: {
            enable: true,
            center: {
                x: 120,
                y: 45,
            },
        },
    },
    interactivity: {
        events: {},
    },
    smooth: true,
    fpsLimit: 120,
    background: {
        color: "transparent",
        size: "cover",
    },
    fullScreen: {
        enable: false,
    },
    detectRetina: true,
    absorbers: [
        {
            enable: true,
            opacity: 0,
            size: {
                value: 1,
                density: 1,
                limit: {
                    radius: 5,
                    mass: 5,
                },
            },
            position: {
                x: 110,
                y: 45,
            },
        },
    ],
    emitters: [
        {
            autoPlay: true,
            fill: true,
            life: {
                wait: true,
            },
            rate: {
                quantity: 5,
                delay: 0.5,
            },
            position: {
                x: 110,
                y: 45,
            },
        },
    ],
};

interface SparkleButtonProps {
    onClick: () => void;
    children: React.ReactNode;
    style?: React.CSSProperties;
}

export const SparkleButton = ({ onClick, children, style }: SparkleButtonProps) => {
    const [particleState, setParticlesReady] = useState<"loaded" | "ready">();
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        initParticlesEngine(async (engine) => {
            await loadFull(engine);
        }).then(() => {
            setParticlesReady("loaded");
        });
    }, []);

    const modifiedOptions = useMemo(() => {
        options.autoPlay = isHovering;
        return options;
    }, [isHovering]);

    return (
        <button
            className="empty-state-btn primary"
            onClick={onClick}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            style={{
                position: 'relative',
                overflow: 'hidden', // Contain particles
                // We keep the standard class styles but need relative positioning for particles
                ...style,
            }}
        >
            <Sparkles size={16} className={`filled-icon ${isHovering ? 'animate-pulse' : ''}`} style={{ zIndex: 10, position: 'relative' }} />
            <span style={{ zIndex: 10, position: 'relative' }}>{children}</span>

            {!!particleState && (
                <div style={{
                    position: 'absolute',
                    inset: -10, // Slight overflow to allow particles to start/end gracefully if needed
                    pointerEvents: 'none',
                    zIndex: 0,
                    opacity: particleState === "ready" && isHovering ? 1 : 0,
                    transition: 'opacity 0.2s',
                    borderRadius: 'inherit'
                }}>
                    <Particles
                        id="sparkle-particles"
                        particlesLoaded={async () => {
                            setParticlesReady("ready");
                        }}
                        options={modifiedOptions}
                        style={{ width: '100%', height: '100%' }}
                    />
                </div>
            )}
        </button>
    );
};
