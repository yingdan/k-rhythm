import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Collapse,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  CalendarToday,
  FilterList,
  Campaign,
  TrendingUp,
  TrendingDown,
  Remove,
  AccountBalance,
  ShowChart,
  CurrencyExchange,
  Business,
} from '@mui/icons-material';
import type { UsEvent, UsEventType } from '../../types/api';

interface EventPanelProps {
  events: UsEvent[];
  currentBarDate?: string; // Current decision bar date for highlighting
  onEventClick?: (event: UsEvent) => void;
  height?: number;
}

const EVENT_ICONS: Record<UsEventType, React.ReactNode> = {
  earnings: <ShowChart fontSize="small" />,
  fed: <AccountBalance fontSize="small" />,
  economic: <CurrencyExchange fontSize="small" />,
  split: <TrendingUp fontSize="small" />,
  dividend: <TrendingUp fontSize="small" />,
  corporate: <Business fontSize="small" />,
  macro: <Campaign fontSize="small" />,
};

const EVENT_LABELS: Record<UsEventType, string> = {
  earnings: '财报',
  fed: '美联储',
  economic: '经济数据',
  split: '拆股',
  dividend: '分红',
  corporate: '公司事件',
  macro: '宏观事件',
};

const IMPACT_COLORS: Record<string, string> = {
  positive: '#4caf50',
  negative: '#f44336',
  neutral: '#9e9e9e',
};

const IMPACT_ICONS: Record<string, React.ReactNode> = {
  positive: <TrendingUp fontSize="small" sx={{ color: '#4caf50' }} />,
  negative: <TrendingDown fontSize="small" sx={{ color: '#f44336' }} />,
  neutral: <Remove fontSize="small" sx={{ color: '#9e9e9e' }} />,
};

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export const EventPanel: React.FC<EventPanelProps> = ({
  events,
  currentBarDate,
  onEventClick,
  height = 550,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterTypes, setFilterTypes] = useState<UsEventType[]>([]);
  const [showAll, setShowAll] = useState(false);

  const filteredEvents = useMemo(() => {
    let result = events;
    if (filterTypes.length > 0) {
      result = result.filter((e) => filterTypes.includes(e.type));
    }
    return result.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [events, filterTypes]);

  const displayedEvents = showAll ? filteredEvents : filteredEvents.slice(-30);

  // Determine if an event is near the current bar
  const isNearCurrentBar = (eventDate: string) => {
    if (!currentBarDate) return false;
    const ed = new Date(eventDate + 'T00:00:00');
    const cd = new Date(currentBarDate);
    const diff = Math.abs(ed.getTime() - cd.getTime());
    return diff <= 24 * 60 * 60 * 1000; // within 1 day
  };

  const handleToggleFilter = (
    _event: React.MouseEvent<HTMLElement>,
    newFilters: UsEventType[]
  ) => {
    setFilterTypes(newFilters);
  };

  if (events.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.paper',
          borderRadius: 1,
          p: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          该股票暂无事件数据
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Campaign fontSize="small" color="primary" />
          <Typography variant="subtitle2">
            历史事件 ({filteredEvents.length})
          </Typography>
        </Box>
        <Tooltip title={showAll ? '显示最近30条' : '显示全部'}>
          <IconButton size="small" onClick={() => setShowAll(!showAll)}>
            <FilterList fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Filters */}
      <Box sx={{ px: 1, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
        <ToggleButtonGroup
          value={filterTypes}
          onChange={handleToggleFilter}
          size="small"
          sx={{ flexWrap: 'wrap', gap: 0.5 }}
        >
          {(Object.keys(EVENT_LABELS) as UsEventType[]).map((type) => (
            <ToggleButton
              key={type}
              value={type}
              sx={{
                py: 0.25,
                px: 1,
                fontSize: '0.65rem',
                textTransform: 'none',
              }}
            >
              {EVENT_LABELS[type]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Event list */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 1 }}>
        {displayedEvents.map((event, idx) => {
          const eventId = `${event.date}-${event.symbol}-${idx}`;
          const isExpanded = expandedId === eventId;
          const nearCurrent = isNearCurrentBar(event.date);

          return (
            <Box
              key={eventId}
              sx={{
                borderLeft: 3,
                borderColor: nearCurrent
                  ? 'primary.main'
                  : IMPACT_COLORS[event.impact] || '#9e9e9e',
                ml: 1,
                pl: 1,
                py: 0.75,
                mb: 0.5,
                bgcolor: nearCurrent ? 'action.selected' : 'transparent',
                borderRadius: '0 4px 4px 0',
                cursor: 'pointer',
                transition: 'background 0.15s',
                '&:hover': { bgcolor: 'action.hover' },
              }}
              onClick={() => {
                setExpandedId(isExpanded ? null : eventId);
                onEventClick?.(event);
              }}
            >
              {/* Compact row */}
              <Box display="flex" alignItems="center" gap={0.5}>
                {EVENT_ICONS[event.type]}
                <CalendarToday sx={{ fontSize: 10, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 42 }}>
                  {formatEventDate(event.date)}
                </Typography>
                {IMPACT_ICONS[event.impact]}
                <Typography
                  variant="caption"
                  sx={{
                    flex: 1,
                    fontWeight: nearCurrent ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: isExpanded ? 'normal' : 'nowrap',
                    lineHeight: 1.3,
                  }}
                >
                  {event.title}
                </Typography>
                <IconButton
                  size="small"
                  sx={{ p: 0, ml: 'auto' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedId(isExpanded ? null : eventId);
                  }}
                >
                  {isExpanded ? (
                    <ExpandLess fontSize="small" />
                  ) : (
                    <ExpandMore fontSize="small" />
                  )}
                </IconButton>
              </Box>

              {/* Event type chip */}
              <Chip
                label={EVENT_LABELS[event.type]}
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  mt: 0.25,
                  ml: 3.5,
                }}
                variant="outlined"
              />

              {/* Expanded details */}
              <Collapse in={isExpanded}>
                <Box
                  sx={{
                    mt: 0.75,
                    p: 1,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    ml: 1,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {event.description}
                  </Typography>
                  {event.price_reaction && (
                    <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                      <TrendingUp
                        sx={{
                          fontSize: 14,
                          color:
                            event.price_reaction.startsWith('+')
                              ? '#4caf50'
                              : event.price_reaction.startsWith('-')
                              ? '#f44336'
                              : '#9e9e9e',
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          color:
                            event.price_reaction.startsWith('+')
                              ? '#4caf50'
                              : event.price_reaction.startsWith('-')
                              ? '#f44336'
                              : 'text.secondary',
                          fontWeight: 600,
                        }}
                      >
                        股价反应: {event.price_reaction}
                      </Typography>
                    </Box>
                  )}
                  <Box display="flex" gap={0.5} mt={0.5}>
                    <Chip
                      label={event.symbol}
                      size="small"
                      sx={{ height: 16, fontSize: '0.6rem' }}
                    />
                    <Chip
                      label={event.impact === 'positive' ? '利好' : event.impact === 'negative' ? '利空' : '中性'}
                      size="small"
                      color={event.impact === 'positive' ? 'success' : event.impact === 'negative' ? 'error' : 'default'}
                      sx={{ height: 16, fontSize: '0.6rem' }}
                    />
                  </Box>
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      {/* Footer */}
      {filteredEvents.length > 30 && !showAll && (
        <Box
          sx={{
            p: 1,
            borderTop: 1,
            borderColor: 'divider',
            textAlign: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setShowAll(true)}
        >
          <Typography variant="caption" color="primary">
            显示全部 {filteredEvents.length} 条事件...
          </Typography>
        </Box>
      )}
    </Box>
  );
};
