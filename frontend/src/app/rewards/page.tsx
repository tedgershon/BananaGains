"use client";

import { Check, Circle, Lock, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { BadgeIcon } from "@/components/badge-icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getUserRewards, updateProfile } from "@/lib/api";
import { useSession } from "@/lib/SessionProvider";
import type { RewardsResponse, TrackProgress } from "@/lib/types";

const TRACK_ICONS: Record<string, string> = {
  banana_baron: "🍌",
  oracle: "🔮",
  architect: "🏗️",
  degen: "🎲",
  whale: "🐋",
};

function TrackCard({
  track,
  equippedBadgeId,
  onEquip,
}: {
  track: TrackProgress;
  equippedBadgeId: string | null;
  onEquip: (badgeId: string | null) => void;
}) {
  const icon = TRACK_ICONS[track.track] ?? "🏆";

  const progressPercent =
    track.next_threshold !== null
      ? Math.min(
          100,
          Math.round((track.current_value / track.next_threshold) * 100),
        )
      : 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span>{icon}</span>
          {track.track_display_name}
        </CardTitle>
        <CardDescription>{track.track_description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {track.next_threshold !== null ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {track.current_value.toLocaleString()} /{" "}
                {track.next_threshold.toLocaleString()}
              </span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted">
              <div
                className="h-2.5 rounded-full transition-all"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor:
                    track.tiers[track.current_tier]?.color ?? "#eab308",
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium text-green-600">
            <Trophy size={16} />
            All tiers completed!
          </div>
        )}

        <div className="space-y-2">
          {track.tiers.map((tier) => {
            const isEarned = tier.tier <= track.current_tier;
            const isNext = tier.tier === track.current_tier + 1;
            const remaining = tier.threshold - track.current_value;
            const isEquipped = equippedBadgeId === tier.id;

            return (
              <div
                key={tier.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                  isEquipped
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-border"
                }`}
              >
                <div className="shrink-0">
                  {!isEarned &&
                    (isNext ? (
                      <Circle size={18} className="text-muted-foreground" />
                    ) : (
                      <Lock size={18} className="text-muted-foreground/50" />
                    ))}
                </div>
                <div className="shrink-0">
                  <BadgeIcon
                    track={track.track}
                    tier={tier.tier}
                    color={tier.color}
                    earned={isEarned}
                    size={28}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${!isEarned && !isNext ? "text-muted-foreground" : ""}`}
                  >
                    {tier.name}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({tier.threshold.toLocaleString()})
                    </span>
                  </p>
                  {tier.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tier.description}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {isEarned ? (
                    <Button
                      size="sm"
                      variant={isEquipped ? "default" : "outline"}
                      className={
                        isEquipped
                          ? "bg-green-600 hover:bg-green-700 text-white gap-1.5"
                          : "gap-1.5"
                      }
                      onClick={() =>
                        onEquip(isEquipped ? null : tier.id)
                      }
                    >
                      {isEquipped && <Check size={14} />}
                      {isEquipped ? "Equipped" : "Equip"}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {isNext
                        ? `${Math.max(0, remaining).toLocaleString()} to go`
                        : "Locked"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function RewardsPage() {
  const { user, updateUser } = useSession();
  const [data, setData] = useState<RewardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [equippedId, setEquippedId] = useState<string | null>(
    user.equipped_badge_id,
  );

  useEffect(() => {
    getUserRewards()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleEquip(badgeId: string | null) {
    const prev = equippedId;
    setEquippedId(badgeId);
    try {
      await updateProfile({ equipped_badge_id: badgeId });
      updateUser({ equipped_badge_id: badgeId });
    } catch {
      setEquippedId(prev);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Rewards</h1>
        <p className="text-sm text-muted-foreground">
          Level up your badges and show off your BananaGains prowess
        </p>
      </section>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6" />
        </div>
      ) : data ? (
        <div className="grid gap-6 md:grid-cols-2">
          {data.tracks.map((track) => (
            <TrackCard
              key={track.track}
              track={track}
              equippedBadgeId={equippedId}
              onEquip={handleEquip}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Failed to load rewards data.
        </p>
      )}
    </div>
  );
}
