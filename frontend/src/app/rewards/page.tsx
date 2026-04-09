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
import type {
  EquippedBadgesMap,
  RewardsResponse,
  TrackProgress,
} from "@/lib/types";

const TRACK_ICONS: Record<string, string> = {
  banana_baron: "🍌",
  oracle: "🔮",
  architect: "🏗️",
  degen: "🎲",
  whale: "🐋",
};

function normalizeEquippedBadges(
  source: EquippedBadgesMap | null | undefined,
): EquippedBadgesMap {
  if (!source) return {};

  const normalized: EquippedBadgesMap = {};
  for (const [track, badgeId] of Object.entries(source)) {
    if (!badgeId) continue;
    normalized[track] = badgeId;
  }
  return normalized;
}

function inferTrackForBadge(
  rewardsData: RewardsResponse | null,
  badgeId: string | null,
): string | null {
  if (!rewardsData || !badgeId) return null;

  for (const track of rewardsData.tracks) {
    if (track.tiers.some((tier) => tier.id === badgeId)) {
      return track.track;
    }
  }

  return null;
}

function TrackCard({
  track,
  equippedBadgeId,
  isSaving,
  onEquip,
}: {
  track: TrackProgress;
  equippedBadgeId: string | null;
  isSaving: boolean;
  onEquip: (track: string, badgeId: string | null) => void;
}) {
  const icon = TRACK_ICONS[track.track] ?? "🏆";
  const currentTierDef = track.tiers.find(
    (tier) => tier.tier === track.current_tier,
  );
  const nextTierDef = track.tiers.find(
    (tier) => tier.tier > track.current_tier,
  );

  const segmentStart = currentTierDef?.threshold ?? 0;
  const segmentEnd = nextTierDef?.threshold ?? null;
  const segmentProgress = Math.max(0, track.current_value - segmentStart);
  const segmentSize =
    segmentEnd !== null ? Math.max(1, segmentEnd - segmentStart) : 1;
  const progressPercent =
    segmentEnd !== null
      ? Math.min(100, Math.round((segmentProgress / segmentSize) * 100))
      : 100;
  const progressColor =
    nextTierDef?.color ?? currentTierDef?.color ?? "#eab308";

  const progressValueLabel = `${segmentProgress.toLocaleString()} / ${segmentSize.toLocaleString()}`;

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
        {nextTierDef ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {progressValueLabel} to {nextTierDef.name}
              </span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted">
              <div
                className="h-2.5 rounded-full transition-all"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: progressColor,
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
                    ? "border-green-500 bg-green-500/10"
                    : "border-border"
                }`}
              >
                <div className="shrink-0">
                  {isEarned ? (
                    <Check
                      size={18}
                      className={
                        isEquipped ? "text-green-600" : "text-green-500"
                      }
                    />
                  ) : isNext ? (
                    <Circle size={18} className="text-muted-foreground" />
                  ) : (
                    <Lock size={18} className="text-muted-foreground/50" />
                  )}
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
                  {isEquipped && (
                    <p className="mt-0.5 text-xs font-medium text-green-700">
                      Showing on leaderboard
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {isEarned ? (
                    <Button
                      size="sm"
                      disabled={isSaving}
                      variant={isEquipped ? "default" : "outline"}
                      className={
                        isEquipped
                          ? "bg-green-600 hover:bg-green-700 text-white gap-1.5"
                          : "gap-1.5"
                      }
                      onClick={() =>
                        onEquip(track.track, isEquipped ? null : tier.id)
                      }
                    >
                      {isEquipped && <Check size={14} />}
                      {isSaving
                        ? "Saving..."
                        : isEquipped
                          ? "Equipped"
                          : "Equip"}
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
  const [savingTrack, setSavingTrack] = useState<string | null>(null);
  const [equippedByTrack, setEquippedByTrack] = useState<EquippedBadgesMap>(
    normalizeEquippedBadges(user.equipped_badges),
  );

  useEffect(() => {
    getUserRewards()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setEquippedByTrack(normalizeEquippedBadges(user.equipped_badges));
  }, [user.equipped_badges]);

  useEffect(() => {
    if (!data || !user.equipped_badge_id) return;

    setEquippedByTrack((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const inferredTrack = inferTrackForBadge(data, user.equipped_badge_id);
      if (!inferredTrack) return prev;
      return { ...prev, [inferredTrack]: user.equipped_badge_id };
    });
  }, [data, user.equipped_badge_id]);

  async function handleEquip(track: string, badgeId: string | null) {
    const prev = { ...equippedByTrack };
    const next = { ...equippedByTrack };
    if (badgeId) {
      next[track] = badgeId;
    } else {
      delete next[track];
    }

    setSavingTrack(track);
    setEquippedByTrack(next);

    const legacyBadge = Object.values(next)[0] ?? null;

    try {
      await updateProfile({
        equipped_badges: next,
        equipped_badge_id: legacyBadge,
      });
      updateUser({
        equipped_badges: next,
        equipped_badge_id: legacyBadge,
      });
    } catch {
      setEquippedByTrack(prev);
    } finally {
      setSavingTrack(null);
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
              equippedBadgeId={equippedByTrack[track.track] ?? null}
              isSaving={savingTrack === track.track}
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
