import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { X, Volume2, VolumeX } from 'lucide-react';
import { Progress } from './ui/progress';

interface RewardedAdModalProps {
  open: boolean;
  onAdComplete: () => void;
  onClose: () => void;
}

export function RewardedAdModal({ open, onAdComplete, onClose }: RewardedAdModalProps) {
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const AD_DURATION = 5; // 5 seconds

  useEffect(() => {
    if (!open) {
      setProgress(0);
      setCanClose(false);
      return;
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + (100 / AD_DURATION);
        if (newProgress >= 100) {
          setCanClose(true);
          clearInterval(interval);
          return 100;
        }
        return newProgress;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open]);

  const handleClose = () => {
    if (canClose) {
      onClose();
    }
  };

  const handleClaimReward = () => {
    onAdComplete();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={canClose ? onClose : undefined}>
      <DialogContent 
        className="max-w-2xl p-0 gap-0 bg-black"
        onPointerDownOutside={(e) => !canClose && e.preventDefault()}
        onEscapeKeyDown={(e) => !canClose && e.preventDefault()}
      >
        {/* Ad Video Container */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 aspect-video">
          {/* Simulated Video Content */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4 p-8">
              <div className="bg-white/10 backdrop-blur rounded-lg p-6 space-y-2">
                <div className="text-white/80 text-sm">Advertisement</div>
                <div className="text-white text-2xl">Sample Ad Content</div>
                <div className="text-white/60 text-sm">
                  This is a simulated rewarded video ad
                </div>
              </div>
            </div>
          </div>

          {/* Close Button (only after ad completes) */}
          {canClose && (
            <button
              onClick={handleClose}
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
            >
              <X className="size-5" />
            </button>
          )}

          {/* Mute Button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
          >
            {isMuted ? (
              <VolumeX className="size-5" />
            ) : (
              <Volume2 className="size-5" />
            )}
          </button>

          {/* Timer Indicator */}
          <div className="absolute top-2 left-2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
            {canClose ? 'Ad Complete!' : `${Math.ceil(AD_DURATION - (progress / 100 * AD_DURATION))}s`}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-slate-900 p-4 space-y-3">
          <Progress value={progress} className="h-2" />
          
          {canClose ? (
            <Button 
              onClick={handleClaimReward}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              Claim Reward & Continue
            </Button>
          ) : (
            <div className="text-center text-sm text-white/60">
              Watch the full ad to earn your mining boost
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}