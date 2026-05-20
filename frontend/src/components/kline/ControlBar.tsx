import { Box, Button, Typography, Chip, LinearProgress, Stack } from '@mui/material';
import { PlayArrow, Pause, Stop, Replay, Speed } from '@mui/icons-material';
import { useState } from 'react';

interface ControlBarProps {
  currentIndex: number;
  totalBars: number;
  isRunning: boolean;
  status: 'idle' | 'training' | 'completed';
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onReset: () => void;
  onAutoPlay?: (interval: number) => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  currentIndex,
  totalBars,
  isRunning,
  status,
  onPause,
  onResume,
  onComplete,
  onReset,
  onAutoPlay,
}) => {
  const progress = totalBars > 0 ? (currentIndex / totalBars) * 100 : 0;
  const [autoPlayInterval, setAutoPlayInterval] = useState(1000);

  const handleAutoPlay = () => {
    if (onAutoPlay) {
      onAutoPlay(autoPlayInterval);
    }
  };

  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
      {/* 进度 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="body2" color="text.secondary">
          K线进度
        </Typography>
        <Chip
          label={`${currentIndex} / ${totalBars}`}
          size="small"
          color={status === 'completed' ? 'success' : 'primary'}
        />
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ mb: 2, height: 8, borderRadius: 4 }}
      />

      {/* 控制按钮 */}
      <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
        {status === 'idle' && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayArrow />}
            onClick={onResume}
          >
            开始训练
          </Button>
        )}

        {status === 'training' && (
          <>
            {isRunning ? (
              <Button variant="outlined" startIcon={<Pause />} onClick={onPause}>
                暂停
              </Button>
            ) : (
              <>
                <Button variant="outlined" startIcon={<PlayArrow />} onClick={onResume}>
                  继续
                </Button>
                {onAutoPlay && (
                  <Button
                    variant="outlined"
                    startIcon={<Speed />}
                    onClick={handleAutoPlay}
                  >
                    自动播放({autoPlayInterval}ms)
                  </Button>
                )}
              </>
            )}

            <Button
              variant="contained"
              color="success"
              startIcon={<Stop />}
              onClick={onComplete}
            >
              完成训练
            </Button>
          </>
        )}

        {status === 'completed' && (
          <Button variant="contained" startIcon={<Replay />} onClick={onReset}>
            重新训练
          </Button>
        )}
      </Stack>

      {/* 自动播放速度控制 */}
      {status === 'training' && !isRunning && onAutoPlay && (
        <Box display="flex" alignItems="center" gap={1} mt={2} justifyContent="center">
          <Typography variant="caption" color="text.secondary">
            自动播放间隔:
          </Typography>
          {[500, 1000, 2000, 5000].map((interval) => (
            <Chip
              key={interval}
              label={`${interval}ms`}
              size="small"
              onClick={() => setAutoPlayInterval(interval)}
              color={autoPlayInterval === interval ? 'primary' : 'default'}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};
