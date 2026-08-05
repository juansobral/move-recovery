import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SetSocioDto } from './dto/set-socio.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list() {
    return this.usersService.findAll();
  }

  @Patch(':id')
  setSocio(@Param('id') id: string, @Body() dto: SetSocioDto) {
    return this.usersService.setSocio(id, dto.isSocio);
  }
}
