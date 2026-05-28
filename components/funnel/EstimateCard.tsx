"use client";

import { computeEstimate, formatCAD } from "@/lib/estimate";
import type { HydroBracketCode } from "@/lib/funnel-config";

interface EstimateCardProps {
  hydroBracket: HydroBracketCode;
  symptomsCount: number;
}

export function EstimateCard({ hydroBracket, symptomsCount }: EstimateCardProps) {
  const estimate = computeEstimate(hydroBracket, symptomsCount);

  return (
    <div className="bg-[#eef5fc] border-4 border-[#aedee5] rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-[32px] w-full flex flex-col gap-[24px] items-center">
      <div className="flex flex-col gap-[16px] items-center text-center w-full">
        <p
          className="font-bold text-[20px] text-[#002042] tracking-[-0.8px] leading-[1.2]"
          style={{ fontFamily: "'Source Serif Pro', serif" }}
        >
          💵 Ton estimation indicative
        </p>
        <h3
          className="font-bold text-[40px] text-[#002042] text-center tracking-[-1.2px] leading-[1.2]"
          style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
        >
          Entre {formatCAD(estimate.min)} et {formatCAD(estimate.max)}
        </h3>
        <p className="font-semibold text-[18px] text-[#375371] text-center tracking-[-0.72px] leading-[1.2]">
          Pour optimiser l&apos;isolation de ta maison.
        </p>
      </div>

      <p className="text-[14px] text-[#375371] text-center italic leading-[1.4] tracking-[-0.42px] max-w-[640px]">
        Cette estimation est basée sur la facture d&apos;Hydro et les symptômes que tu nous as partagés. Le prix final dépend de la superficie réelle, du type de travaux (entretoit, murs, sous-sol) et de l&apos;état actuel. Les entrepreneurs te donneront un devis précis après visite.
      </p>
    </div>
  );
}
