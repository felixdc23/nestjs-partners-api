import { Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ReserveSpotDto } from './dto/reserve-spot.dt';
import { Prisma, SpotStatus, TicketStatus } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(private prismaService: PrismaService) {}

  create(createEventDto: CreateEventDto) {
    return this.prismaService.event.create({
      data: createEventDto,
    });
  }

  findAll() {
    return this.prismaService.event.findMany();
  }

  findOne(id: string) {
    return this.prismaService.event.findUnique({
      where: { id },
    });
  }

  update(id: string, updateEventDto: UpdateEventDto) {
    return this.prismaService.event.update({
      data: updateEventDto,
      where: { id },
    });
  }

  remove(id: string) {
    return this.prismaService.event.delete({
      where: { id },
    });
  }

  async reserveSpot(dto: ReserveSpotDto & { eventId: string }) {
    const spots = await this.prismaService.spot.findMany({
      where: {
        eventId: dto.eventId,
        name: {
          in: dto.spots,
        },
      },
    });

    if (spots.length !== dto.spots.length) {
      const foundSpotsName = spots.map((spot) => spot.name);
      const notFoundSpotsName = dto.spots.filter(
        (spotName) => !foundSpotsName.includes(spotName),
      );

      throw new Error(`Spots ${notFoundSpotsName.join(', ')} not found)`);
    }

    try {
      const tickets = await this.prismaService.$transaction(
        async (prisma) => {
          await prisma.reservationHistory.createMany({
            data: spots.map((spot) => ({
              spotId: spot.id,
              ticketKind: dto.ticket_kind,
              email: dto.email,
              status: TicketStatus.reserved,
            })),
          });

          await this.prismaService.spot.updateMany({
            where: {
              id: {
                in: spots.map((spot) => spot.id),
              },
            },
            data: {
              status: SpotStatus.reserved,
            },
          });

          const tickets = await Promise.all(
            spots.map((spot) =>
              this.prismaService.ticket.create({
                data: {
                  spotId: spot.id,
                  ticketKind: dto.ticket_kind,
                  email: dto.email,
                },
              }),
            ),
          );

          return tickets;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        switch (e.code) {
          case 'P2002':
          case 'P2034':
            throw new Error('Some spots already reserved');
          default:
            throw e;
        }
      }
    }
  }
}
